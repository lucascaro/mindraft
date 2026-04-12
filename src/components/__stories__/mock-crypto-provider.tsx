"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Minimal mock of CryptoProvider for Storybook stories.
 * Provides a no-op crypto context with encryption disabled.
 */

type CryptoContextType = {
  mk: CryptoKey | null;
  locked: boolean;
  encryptionEnabled: boolean;
  unlockError: string | null;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  enableEncryption: (passphrase: string) => Promise<void>;
  changePassphrase: (oldPassphrase: string, newPassphrase: string) => Promise<void>;
  disableEncryption: (passphrase: string) => Promise<void>;
};

// Re-use the same context identity so useCrypto() from crypto-context.tsx picks it up.
// We import the actual module and provide a value — no need to duplicate the context.

// Actually, since CryptoContext is not exported, we need to wrap with the real provider
// or mock at the module level. The simplest approach: re-export a wrapper.

import { CryptoProvider } from "@/lib/crypto-context";

export function MockCryptoProvider({ children }: { children: ReactNode }) {
  // CryptoProvider with userId=null → encryption disabled, mk=null
  return <CryptoProvider userId={null}>{children}</CryptoProvider>;
}
