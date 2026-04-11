"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import {
  deriveKEK,
  generateMasterKey,
  generateSalt,
  unwrapMasterKey,
  wrapMasterKey,
} from "./crypto";
import type { EncryptionPrefs } from "./types";

const PREFS_COLLECTION = "userPrefs";

const ARGON2_PARAMS = {
  algorithm: "argon2id" as const,
  memory: 64 * 1024, // stored in Firestore as kdfParams.memory (KiB)
  iterations: 3,
  parallelism: 1,
};

// ── Context type ──────────────────────────────────────────────────────────────

type CryptoContextType = {
  /** Non-extractable session Master Key, or null when locked / encryption disabled */
  mk: CryptoKey | null;
  /** True when encryption is enabled but the MK has not been unlocked yet */
  locked: boolean;
  /** True when the user has encryption enabled */
  encryptionEnabled: boolean;
  /** Error from the last unlock attempt, cleared on success */
  unlockError: string | null;
  /**
   * Attempt to unlock the session by deriving the KEK and unwrapping the MK.
   * Returns true on success, false on wrong passphrase.
   */
  unlock: (passphrase: string) => Promise<boolean>;
  /** Zero the in-memory MK and mark as locked */
  lock: () => void;
  /**
   * Enable encryption: generate a fresh MK, wrap it with the passphrase,
   * and persist to userPrefs. Does NOT encrypt existing idea documents.
   */
  enableEncryption: (passphrase: string) => Promise<void>;
  /**
   * Change passphrase: re-wrap the existing MK with the new passphrase.
   * Increments mkVersion so any running stdio servers re-prompt.
   */
  changePassphrase: (
    oldPassphrase: string,
    newPassphrase: string
  ) => Promise<void>;
  /**
   * Disable encryption: sets enabled: false in userPrefs.
   * Does NOT decrypt existing idea documents (that is the Phase 4 migration tool).
   * Requires the correct passphrase to prevent accidental disablement.
   */
  disableEncryption: (passphrase: string) => Promise<void>;
};

const CryptoContext = createContext<CryptoContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────

export function CryptoProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [mk, setMk] = useState<CryptoKey | null>(null);
  const [locked, setLocked] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Stable ref to the current encryption prefs so async functions always see
  // the latest value without needing to be re-created on every change.
  const prefsRef = useRef<EncryptionPrefs | null>(null);

  // Subscribe to userPrefs.encryption and react to changes
  useEffect(() => {
    if (!userId || !isFirebaseConfigured) {
      setEncryptionEnabled(false);
      setLocked(false);
      setMk(null);
      prefsRef.current = null;
      return;
    }

    const ref = doc(getDb(), PREFS_COLLECTION, userId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data();
      const prefs = data?.encryption as EncryptionPrefs | undefined;
      prefsRef.current = prefs ?? null;

      const enabled = prefs?.enabled === true;
      setEncryptionEnabled(enabled);

      if (!enabled) {
        // Encryption disabled — no-op mode
        setLocked(false);
        setMk(null);
        return;
      }

      // Encryption enabled — if we don't have an MK in memory, go locked
      setMk((prev) => {
        if (!prev) setLocked(true);
        return prev;
      });
    });

    return unsubscribe;
  }, [userId]);

  const lock = () => {
    setMk(null);
    setLocked(true);
    setUnlockError(null);
  };

  const unlock = async (passphrase: string): Promise<boolean> => {
    const prefs = prefsRef.current;
    if (!prefs?.wrappedMK || !prefs.salt) return false;

    try {
      const kek = await deriveKEK(passphrase, prefs.salt);
      const sessionMK = await unwrapMasterKey(prefs.wrappedMK, kek);
      setMk(sessionMK);
      setLocked(false);
      setUnlockError(null);
      return true;
    } catch {
      setUnlockError("Incorrect passphrase. Please try again.");
      return false;
    }
  };

  const enableEncryption = async (passphrase: string): Promise<void> => {
    if (!userId) throw new Error("Not signed in");

    const salt = generateSalt();
    const { mk: extractableMK, raw } = await generateMasterKey();

    const kek = await deriveKEK(passphrase, salt);
    const wrappedMK = await wrapMasterKey(extractableMK, kek);
    // Zero raw bytes — the session handle comes from unwrapMasterKey
    raw.fill(0);

    const newPrefs: EncryptionPrefs = {
      enabled: true,
      wrappedMK,
      salt,
      kdfParams: ARGON2_PARAMS,
      version: 1,
      mkVersion: 1,
    };

    const ref = doc(getDb(), PREFS_COLLECTION, userId);
    await setDoc(ref, { encryption: newPrefs }, { merge: true });

    // Derive session handle (non-extractable)
    const kekForSession = await deriveKEK(passphrase, salt);
    const sessionMK = await unwrapMasterKey(wrappedMK, kekForSession);
    setMk(sessionMK);
    setLocked(false);
    prefsRef.current = newPrefs;
  };

  const changePassphrase = async (
    oldPassphrase: string,
    newPassphrase: string
  ): Promise<void> => {
    if (!userId) throw new Error("Not signed in");
    const prefs = prefsRef.current;
    if (!prefs?.wrappedMK) throw new Error("Encryption not enabled");

    // Verify old passphrase first
    const oldKEK = await deriveKEK(oldPassphrase, prefs.salt);
    const extractableMK = await (async () => {
      // We need to re-wrap: unwrap with old KEK as extractable, then re-wrap
      const wrappedBytes = Uint8Array.from(
        atob(prefs.wrappedMK),
        (c) => c.charCodeAt(0)
      );
      return crypto.subtle.unwrapKey(
        "raw",
        wrappedBytes,
        oldKEK,
        "AES-KW",
        { name: "AES-GCM", length: 256 },
        true, // extractable: true so we can re-wrap with new KEK
        ["encrypt", "decrypt"]
      );
    })();

    const newSalt = generateSalt();
    const newKEK = await deriveKEK(newPassphrase, newSalt);
    const newWrappedMK = await wrapMasterKey(extractableMK, newKEK);

    const updated: Partial<EncryptionPrefs> = {
      wrappedMK: newWrappedMK,
      salt: newSalt,
      kdfParams: ARGON2_PARAMS,
      mkVersion: (prefs.mkVersion ?? 1) + 1,
    };

    const ref = doc(getDb(), PREFS_COLLECTION, userId);
    await updateDoc(ref, { encryption: { ...prefs, ...updated } });

    // Update session handle with new non-extractable key
    const sessionKEK = await deriveKEK(newPassphrase, newSalt);
    const sessionMK = await unwrapMasterKey(newWrappedMK, sessionKEK);
    setMk(sessionMK);
    setLocked(false);
  };

  const disableEncryption = async (passphrase: string): Promise<void> => {
    if (!userId) throw new Error("Not signed in");
    const prefs = prefsRef.current;
    if (!prefs?.wrappedMK) throw new Error("Encryption not enabled");

    // Verify passphrase before disabling
    const kek = await deriveKEK(passphrase, prefs.salt);
    await unwrapMasterKey(prefs.wrappedMK, kek); // throws if wrong

    const ref = doc(getDb(), PREFS_COLLECTION, userId);
    await updateDoc(ref, {
      encryption: { ...prefs, enabled: false },
    });

    setMk(null);
    setLocked(false);
    setEncryptionEnabled(false);
  };

  return (
    <CryptoContext.Provider
      value={{
        mk,
        locked,
        encryptionEnabled,
        unlockError,
        unlock,
        lock,
        enableEncryption,
        changePassphrase,
        disableEncryption,
      }}
    >
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const context = useContext(CryptoContext);
  if (context === undefined) {
    throw new Error("useCrypto must be used within a CryptoProvider");
  }
  return context;
}
