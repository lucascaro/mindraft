"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * E2E mock for @/lib/auth-context.
 * Always provides an authenticated test user — no Firebase Auth SDK needed.
 */

type AuthContextType = {
  user: { uid: string; displayName: string | null; email: string | null } | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const mockUser = {
  uid: "e2e-test-user",
  displayName: "Test User",
  email: "test@example.com",
};

const AuthContext = createContext<AuthContextType>({
  user: mockUser,
  loading: false,
  signInWithGoogle: async () => {},
  signOut: async () => {
    if (typeof window !== "undefined") window.location.href = "/login";
  },
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: mockUser,
        loading: false,
        signInWithGoogle: async () => {},
        signOut: async () => {
          if (typeof window !== "undefined") window.location.href = "/login";
        },
        deleteAccount: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
