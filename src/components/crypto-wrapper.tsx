"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { CryptoProvider } from "@/lib/crypto-context";
import { PassphrasePrompt } from "@/components/passphrase-prompt";

/**
 * Bridges Firebase auth state to the CryptoProvider.
 * Must be a client component so it can call useAuth().
 * Rendered inside AuthProvider in the root layout.
 */
export function CryptoWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <CryptoProvider userId={user?.uid ?? null}>
      <PassphrasePrompt />
      {children}
    </CryptoProvider>
  );
}
