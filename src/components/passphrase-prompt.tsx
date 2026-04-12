"use client";

import { useState, useRef, useEffect } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrypto } from "@/lib/crypto-context";
import { useAuth } from "@/lib/auth-context";

/**
 * Full-screen passphrase prompt overlay.
 * Shown automatically when encryption is enabled but the MK is not yet unlocked.
 * The user cannot dismiss it without either entering the correct passphrase
 * or signing out.
 */
export function PassphrasePrompt() {
  const { locked, encryptionEnabled, unlock, unlockError } = useCrypto();
  const { signOut } = useAuth();
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the prompt appears
  useEffect(() => {
    if (locked && encryptionEnabled) {
      inputRef.current?.focus();
    }
  }, [locked, encryptionEnabled]);

  if (!locked || !encryptionEnabled) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) return;
    setLoading(true);
    await unlock(passphrase);
    setLoading(false);
    // On success, `locked` becomes false and this component returns null
    // On failure, `unlockError` is set and the prompt stays visible
    setPassphrase("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Unlock your notes"
    >
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-xl border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold">Your notes are encrypted</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your passphrase to unlock
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                ref={inputRef}
                type="password"
                placeholder="Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
              {unlockError && (
                <p className="text-sm text-destructive mt-1.5" role="alert">
                  {unlockError}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !passphrase}>
              {loading ? "Unlocking…" : "Unlock"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
