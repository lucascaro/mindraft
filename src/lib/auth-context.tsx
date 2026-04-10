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
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  deleteUser,
  reauthenticateWithPopup,
  type User,
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
    // Wait for getRedirectResult to settle before clearing the loading
    // state. onAuthStateChanged fires immediately with null (before the
    // redirect credential is processed), which would flash the login page
    // if we set loading=false on that first call.
    let redirectSettled = false;
    getRedirectResult(auth)
      .then((result) => {
        redirectSettled = true;
        // If no redirect was pending, result is null and
        // onAuthStateChanged already fired — clear loading now.
        if (!result) setLoading(false);
        // If result is non-null, onAuthStateChanged will fire next
        // with the signed-in user and clear loading below.
      })
      .catch((err) => {
        redirectSettled = true;
        console.error("Google sign-in redirect failed:", err);
        setLoading(false);
      });
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // Only clear loading here once the redirect check is done,
      // or if we already have a signed-in user.
      if (redirectSettled || user) setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithRedirect(getAuthInstance(), googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(getAuthInstance());
    await wipeFirestoreCache();
    // Hard-reload to drop all in-memory state (React tree, Firestore
    // subscriptions, any cached user data) — belt-and-suspenders for
    // shared-device scenarios.
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
