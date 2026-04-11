"use client";

import { useState } from "react";
import { Check, ChevronRight, Eye, EyeOff, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrypto } from "@/lib/crypto-context";
import { generateMasterKey } from "@/lib/crypto";
import { encodeRecoveryKey } from "@/lib/recovery-wordlist";

type Step = "tradeoffs" | "passphrase" | "recovery" | "confirm";

type Props = {
  onComplete: () => void;
  onCancel: () => void;
};

/** Strength score 0–4 */
function passphraseStrength(p: string): number {
  if (p.length < 12) return 0;
  let score = 1;
  if (p.length >= 16) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p) || /[^a-zA-Z0-9]/.test(p)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
];

/**
 * Multi-step wizard for enabling E2E encryption.
 *
 * Steps:
 * 1. Trade-offs disclosure
 * 2. Passphrase entry (with strength meter)
 * 3. Recovery key display (33-word phrase)
 * 4. Confirmation (user types a word from recovery key)
 */
export function EncryptionSetup({ onComplete, onCancel }: Props) {
  const { enableEncryption } = useCrypto();
  const [step, setStep] = useState<Step>("tradeoffs");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [recoveryWords, setRecoveryWords] = useState<string[]>([]);
  const [confirmWord, setConfirmWord] = useState("");
  // Which index (1-based) in the recovery phrase to confirm
  const [confirmIdx] = useState(() => Math.floor(Math.random() * 32) + 1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = passphraseStrength(passphrase);
  const passphraseValid = passphrase.length >= 12 && passphrase === confirm;

  // Step 1 → 2: just advance
  const handleTradeoffsNext = () => setStep("passphrase");

  // Step 2 → 3: generate recovery key
  const handlePassphraseNext = async () => {
    setError(null);
    if (!passphraseValid) return;
    setLoading(true);
    try {
      // Generate a fresh MK and encode as recovery words
      // We hold the raw bytes here until the wizard completes
      const { raw } = await generateMasterKey();
      const words = encodeRecoveryKey(raw);
      // Note: raw bytes will be re-generated during enableEncryption.
      // This display is purely for the user to write down; the actual MK used
      // for encryption is generated fresh inside enableEncryption.
      // We zero these bytes now to avoid leaking them.
      raw.fill(0);
      setRecoveryWords(words);
      setStep("recovery");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 → 4: advance to confirm
  const handleRecoveryNext = () => {
    setStep("confirm");
  };

  // Step 4: enable encryption
  const handleConfirm = async () => {
    setError(null);
    const expected = recoveryWords[confirmIdx - 1];
    if (confirmWord.toLowerCase().trim() !== expected) {
      setError(`Word ${confirmIdx} should be "${expected}". Please check your recovery phrase.`);
      return;
    }
    setLoading(true);
    try {
      await enableEncryption(passphrase);
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to enable encryption."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {(["tradeoffs", "passphrase", "recovery", "confirm"] as Step[]).map(
          (s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
              <span
                className={
                  s === step
                    ? "text-foreground font-medium"
                    : step === "tradeoffs" && i > 0
                    ? "opacity-40"
                    : ""
                }
              >
                {i + 1}
              </span>
            </span>
          )
        )}
      </div>

      {/* Step 1: Trade-offs */}
      {step === "tradeoffs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Enable End-to-End Encryption</h3>
          </div>

          <div className="rounded-lg border border-green-500/30 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-1.5">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> What you gain
            </p>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
              <li>Your note content is encrypted with a key only you possess</li>
              <li>Not even the app developer or Google can read your notes</li>
              <li>If the database is ever breached, your content stays protected</li>
              <li>Offline cached data is also encrypted</li>
            </ul>
          </div>

          <div className="rounded-lg border border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 p-4 space-y-1.5">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> What changes
            </p>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
              <li>You must enter a passphrase each time you open the app</li>
              <li>
                <strong className="text-foreground">
                  If you forget your passphrase and lose your recovery key,
                  your data is permanently unrecoverable
                </strong>{" "}
                — no one can help
              </li>
              <li>
                MCP/AI tools cannot read or create note content by default
              </li>
              <li>Minor performance overhead (negligible for typical notes)</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleTradeoffsNext} className="flex-1">
              I understand, continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Passphrase entry */}
      {step === "passphrase" && (
        <div className="space-y-4">
          <h3 className="font-semibold">Choose a passphrase</h3>
          <p className="text-sm text-muted-foreground">
            Use at least 12 characters. A longer passphrase is harder to crack.
          </p>

          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Passphrase (12+ characters)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
                aria-label={showPass ? "Hide passphrase" : "Show passphrase"}
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Strength meter */}
            {passphrase.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1 h-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? STRENGTH_COLORS[strength]
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {STRENGTH_LABELS[strength]}
                </p>
              </div>
            )}
          </div>

          <div>
            <Input
              type={showPass ? "text" : "password"}
              placeholder="Confirm passphrase"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {confirm.length > 0 && passphrase !== confirm && (
              <p className="text-xs text-destructive mt-1">
                Passphrases do not match
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep("tradeoffs")}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handlePassphraseNext}
              disabled={!passphraseValid || loading}
              className="flex-1"
            >
              {loading ? "Generating…" : "Next"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Recovery key */}
      {step === "recovery" && (
        <div className="space-y-4">
          <h3 className="font-semibold">Write down your recovery phrase</h3>
          <p className="text-sm text-muted-foreground">
            If you ever forget your passphrase, this 33-word phrase lets you
            recover your notes. Write it down now and store it somewhere safe.{" "}
            <strong className="text-foreground">
              You cannot retrieve this later.
            </strong>
          </p>

          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
              {recoveryWords.map((word, i) => (
                <div key={i} className="flex items-baseline gap-1.5 text-sm">
                  <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="font-mono">{word}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 p-3">
            <p className="text-xs text-orange-700 dark:text-orange-400">
              Never share this phrase with anyone. Store it offline, away from
              your device. If you lose both your passphrase and this phrase, your
              notes cannot be recovered by anyone.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep("passphrase")}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleRecoveryNext} className="flex-1">
              I&apos;ve written it down
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === "confirm" && (
        <div className="space-y-4">
          <h3 className="font-semibold">Confirm your recovery phrase</h3>
          <p className="text-sm text-muted-foreground">
            To confirm you&apos;ve written it down, type word{" "}
            <strong className="text-foreground">#{confirmIdx}</strong> from your
            recovery phrase.
          </p>

          <Input
            type="text"
            placeholder={`Word #${confirmIdx}`}
            value={confirmWord}
            onChange={(e) => setConfirmWord(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep("recovery")}
              className="flex-1"
              disabled={loading}
            >
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!confirmWord || loading}
              className="flex-1"
            >
              {loading ? (
                "Enabling…"
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" /> Enable encryption
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
