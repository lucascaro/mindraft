"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  deleteUser,
  reauthenticateWithPopup,
  type User,
  type AuthError,
} from "firebase/auth";
import {
  terminate,
  clearIndexedDbPersistence,
} from "firebase/firestore";
import { getAuthInstance, getDb, googleProvider, isFirebaseConfigured } from "./firebase";
import { deleteAllUserIdeas } from "./firestore";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Wipes the local Firestore IndexedDB cache so no previous-user data
 * lingers on a shared device. Safe to call even if no cache exists.
 */
async function wipeFirestoreCache() {
  try {
    await terminate(getDb());
    await clearIndexedDbPersistence(getDb());
  } catch {
    // Best-effort. If the cache can't be cleared (e.g. another tab has
    // it open, or IDB isn't available), we still sign the user out.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(getAuthInstance(), googleProvider);
    } catch (err) {
      const code = (err as AuthError)?.code;
      // User closed the popup — not an error worth surfacing.
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      console.error("Google sign-in failed:", err);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(getAuthInstance());
    await wipeFirestoreCache();
    // Hard-reload to drop all in-memory state (React tree, Firestore
    // subscriptions, cached user data, and the in-memory encryption MK).
    // CryptoProvider also zeros the MK when userId becomes null, but the
    // hard reload is the definitive cleanup for shared-device scenarios.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const deleteAccount = async () => {
    const current = getAuthInstance().currentUser;
    if (!current) throw new Error("Not signed in");

    // Wipe all Firestore data first while the user is still authed.
    await deleteAllUserIdeas(current.uid);

    // Then delete the Auth user. Firebase requires a "recent" sign-in
    // for sensitive operations; if the token is stale, re-auth via the
    // same Google popup and retry.
    try {
      await deleteUser(current);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/requires-recent-login") {
        await reauthenticateWithPopup(current, googleProvider);
        await deleteUser(current);
      } else {
        throw err;
      }
    }

    await wipeFirestoreCache();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signOut, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
