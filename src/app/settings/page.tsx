"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCrypto } from "@/lib/crypto-context";
import {
  exportAllIdeas,
  countEncryptionStatus,
  migrateToEncrypted,
  migrateToPlaintext,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EncryptionSetup } from "@/components/encryption-setup";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Loader2,
  Trash2,
  User as UserIcon,
} from "lucide-react";

export default function SettingsPage() {
  const { user, loading, deleteAccount } = useAuth();
  const { mk, encryptionEnabled, disableEncryption, unlock } = useCrypto();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [showEncryptionSetup, setShowEncryptionSetup] = useState(false);
  const [confirmingDisableEncryption, setConfirmingDisableEncryption] =
    useState(false);
  const [disablePassphrase, setDisablePassphrase] = useState("");
  const [disablingEncryption, setDisablingEncryption] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  // Migration state
  const [plaintextCount, setPlaintextCount] = useState<number | null>(null);
  const [encryptedCount, setEncryptedCount] = useState<number | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [showDecryptOption, setShowDecryptOption] = useState(false);
  const [confirmSkipDecrypt, setConfirmSkipDecrypt] = useState(false);

  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "/api/mcp";

  const claudeConfig = JSON.stringify(
    { mcpServers: { mindraft: { url: mcpUrl } } },
    null,
    2
  );

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Count plaintext vs encrypted docs when encryption is enabled
  useEffect(() => {
    let cancelled = false;

    if (!user || !encryptionEnabled) {
      setPlaintextCount(null);
      setEncryptedCount(null);
      return () => { cancelled = true; };
    }

    countEncryptionStatus(user.uid)
      .then(({ plaintext, encrypted }) => {
        if (cancelled) return;
        setPlaintextCount(plaintext);
        setEncryptedCount(encrypted);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to count encryption status:", err);
      });

    return () => { cancelled = true; };
  }, [user, encryptionEnabled]);

  const handleExport = async () => {
    if (!user) return;
    setError(null);
    setExporting(true);
    try {
      const ideas = await exportAllIdeas(user.uid, mk);
      // Convert Firestore Timestamps to ISO strings for portability.
      const serializable = ideas.map((i) => ({
        ...i,
        createdAt: i.createdAt?.toDate?.().toISOString() ?? null,
        updatedAt: i.updatedAt?.toDate?.().toISOString() ?? null,
        archivedAt: i.archivedAt?.toDate?.().toISOString() ?? null,
      }));
      const payload = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        },
        ideas: serializable,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mindraft-export-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Export failed. Please try again.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleEncryptAll = async (): Promise<boolean> => {
    if (!user || !mk) return false;
    setMigrating(true);
    setMigrationError(null);
    setMigrationResult(null);
    setMigrationProgress({ processed: 0, total: plaintextCount ?? 0 });
    try {
      const result = await migrateToEncrypted(user.uid, mk, (processed, total) => {
        setMigrationProgress({ processed, total });
      });
      setMigrationResult(
        `Encrypted ${result.processed} note${result.processed !== 1 ? "s" : ""}.`
      );
      setPlaintextCount(0);
      setEncryptedCount((prev) => (prev ?? 0) + result.processed);
      return true;
    } catch (err) {
      setMigrationError(
        err instanceof Error ? err.message : "Migration failed. You can retry safely."
      );
      // Re-fetch actual counts after partial failure
      const counts = await countEncryptionStatus(user.uid);
      setPlaintextCount(counts.plaintext);
      setEncryptedCount(counts.encrypted);
      return false;
    } finally {
      setMigrating(false);
      setMigrationProgress(null);
    }
  };

  const handleDecryptAll = async (): Promise<boolean> => {
    if (!user || !mk) return false;
    setMigrating(true);
    setMigrationError(null);
    setMigrationResult(null);
    setMigrationProgress({ processed: 0, total: encryptedCount ?? 0 });
    try {
      const result = await migrateToPlaintext(user.uid, mk, (processed, total) => {
        setMigrationProgress({ processed, total });
      });
      setMigrationResult(
        `Decrypted ${result.processed} note${result.processed !== 1 ? "s" : ""}.`
      );
      setEncryptedCount(0);
      setPlaintextCount((prev) => (prev ?? 0) + result.processed);
      return true;
    } catch (err) {
      setMigrationError(
        err instanceof Error ? err.message : "Migration failed. You can retry safely."
      );
      // Re-fetch actual counts after partial failure
      const counts = await countEncryptionStatus(user.uid);
      setPlaintextCount(counts.plaintext);
      setEncryptedCount(counts.encrypted);
      return false;
    } finally {
      setMigrating(false);
      setMigrationProgress(null);
    }
  };

  const handleDisableEncryption = async () => {
    setEncryptionError(null);
    setDisablingEncryption(true);
    try {
      await disableEncryption(disablePassphrase);
      setConfirmingDisableEncryption(false);
      setDisablePassphrase("");
      setShowDecryptOption(false);
    } catch {
      setEncryptionError("Incorrect passphrase. Please try again.");
    } finally {
      setDisablingEncryption(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // deleteAccount reloads the window on success; if we reach here
      // without a reload, show the error state.
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        code === "auth/popup-closed-by-user"
          ? "Re-authentication cancelled. Your account was not deleted."
          : "Could not delete account. Please try again."
      );
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="flex items-center justify-between mb-6 h-10">
        <Link href="/ideas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-lg font-bold">Settings</h1>
        <div className="w-[72px]" />
      </header>

      <div className="space-y-6">
        {/* Account */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Account
          </h2>
          <div className="flex items-center gap-4">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">
                {user.displayName ?? "Signed in"}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {user.email ?? ""}
              </p>
            </div>
          </div>
        </section>

        {/* Data */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Your data
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Download every idea you&apos;ve saved (active and archived) as
            a JSON file. Nothing leaves your browser.
          </p>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="w-full sm:w-auto"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download my data
              </>
            )}
          </Button>
        </section>

        {/* End-to-End Encryption */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            End-to-End Encryption
          </h2>

          {showEncryptionSetup ? (
            <EncryptionSetup
              onComplete={() => setShowEncryptionSetup(false)}
              onCancel={() => setShowEncryptionSetup(false)}
            />
          ) : encryptionEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <Check className="h-3 w-3" /> Active
                </span>
                <span className="text-muted-foreground">
                  Your note content is end-to-end encrypted.
                </span>
              </div>

              {/* Migration: encrypt existing plaintext notes */}
              {plaintextCount != null && plaintextCount > 0 && !migrating && !migrationResult && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You have{" "}
                    <strong className="text-foreground">
                      {plaintextCount} unencrypted{" "}
                      {plaintextCount === 1 ? "note" : "notes"}
                    </strong>{" "}
                    that {plaintextCount === 1 ? "was" : "were"} created before
                    encryption was enabled.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleEncryptAll}
                    disabled={!mk}
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Encrypt all notes
                  </Button>
                </div>
              )}

              {/* Migration progress */}
              {migrating && migrationProgress && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Migrating... {migrationProgress.processed} /{" "}
                      {migrationProgress.total}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                    aria-valuenow={migrationProgress.processed}
                    aria-valuemin={0}
                    aria-valuemax={migrationProgress.total}
                    aria-label="Encryption migration progress"
                  >
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${
                          migrationProgress.total > 0
                            ? (migrationProgress.processed /
                                migrationProgress.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Migration result */}
              {migrationResult && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5 inline mr-1" />
                  {migrationResult}
                </p>
              )}

              {/* Migration error */}
              {migrationError && (
                <p className="text-sm text-destructive" role="alert">
                  {migrationError}
                </p>
              )}

              {!confirmingDisableEncryption ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmingDisableEncryption(true);
                    setEncryptionError(null);
                    setShowDecryptOption(false);
                  }}
                  disabled={migrating}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  Disable encryption
                </Button>
              ) : !showDecryptOption ? (
                <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
                  <p className="text-sm text-muted-foreground">
                    Enter your passphrase to confirm.
                  </p>
                  <Input
                    type="password"
                    placeholder="Current passphrase"
                    value={disablePassphrase}
                    onChange={(e) => setDisablePassphrase(e.target.value)}
                    autoComplete="current-password"
                  />
                  {encryptionError && (
                    <p className="text-sm text-destructive" role="alert">
                      {encryptionError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConfirmingDisableEncryption(false);
                        setDisablePassphrase("");
                        setEncryptionError(null);
                      }}
                      disabled={disablingEncryption}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (encryptedCount && encryptedCount > 0) {
                          // Verify passphrase before showing decrypt option
                          setDisablingEncryption(true);
                          setEncryptionError(null);
                          try {
                            const valid = await unlock(disablePassphrase);
                            if (!valid) {
                              setEncryptionError("Incorrect passphrase. Please try again.");
                              return;
                            }
                            setShowDecryptOption(true);
                          } finally {
                            setDisablingEncryption(false);
                          }
                        } else {
                          handleDisableEncryption();
                        }
                      }}
                      disabled={!disablePassphrase || disablingEncryption}
                    >
                      {disablingEncryption ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        "Continue"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
                  <p className="text-sm text-muted-foreground">
                    You have{" "}
                    <strong className="text-foreground">
                      {encryptedCount} encrypted{" "}
                      {encryptedCount === 1 ? "note" : "notes"}
                    </strong>
                    . Would you like to decrypt them to plaintext before
                    disabling encryption?
                  </p>

                  {migrating && migrationProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          Decrypting... {migrationProgress.processed} /{" "}
                          {migrationProgress.total}
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-valuenow={migrationProgress.processed}
                        aria-valuemin={0}
                        aria-valuemax={migrationProgress.total}
                        aria-label="Decryption migration progress"
                      >
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${
                              migrationProgress.total > 0
                                ? (migrationProgress.processed /
                                    migrationProgress.total) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {migrationError && (
                    <p className="text-sm text-destructive" role="alert">
                      {migrationError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowDecryptOption(false);
                        setConfirmingDisableEncryption(false);
                        setConfirmSkipDecrypt(false);
                        setDisablePassphrase("");
                      }}
                      disabled={migrating || disablingEncryption}
                    >
                      Cancel
                    </Button>
                    {!confirmSkipDecrypt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmSkipDecrypt(true)}
                        disabled={migrating || disablingEncryption}
                      >
                        Skip, just disable
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-destructive/90 bg-destructive/10 rounded p-2">
                          ⚠️ Your {encryptedCount} encrypted{" "}
                          {encryptedCount === 1 ? "note" : "notes"} will remain
                          encrypted and appear as &ldquo;[encrypted]&rdquo;.
                          If you re-enable encryption later, a new key will be
                          generated and those notes will be{" "}
                          <strong>permanently unreadable</strong>.
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisableEncryption}
                          disabled={migrating || disablingEncryption}
                        >
                          {disablingEncryption ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Disabling…
                            </>
                          ) : (
                            "Yes, disable without decrypting"
                          )}
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        const ok = await handleDecryptAll();
                        if (ok) {
                          await handleDisableEncryption();
                        }
                      }}
                      disabled={migrating || disablingEncryption}
                    >
                      Decrypt all, then disable
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Encrypt your note content so only you can read it — not even
                the developer or Google. Encryption is opt-in and requires a
                passphrase each session.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowEncryptionSetup(true)}
                className="w-full sm:w-auto"
              >
                <Lock className="h-4 w-4 mr-2" />
                Enable end-to-end encryption
              </Button>
            </div>
          )}
        </section>

        {/* AI Agent / MCP */}
        <section id="mcp" className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Agent (MCP)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Connect Claude or any MCP-compatible AI agent to your ideas. The
            agent can list, search, create, and update ideas — but cannot
            permanently delete them.
          </p>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                MCP endpoint URL
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono truncate">
                  {mcpUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyText(mcpUrl, setCopiedUrl)}
                >
                  {copiedUrl ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Claude Desktop / claude_desktop_config.json
              </p>
              <div className="relative">
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto pr-10 max-w-full">
                  {claudeConfig}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 h-7 w-7 p-0"
                  onClick={() => copyText(claudeConfig, setCopiedConfig)}
                >
                  {copiedConfig ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Claude Code (CLI)
              </p>
              <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto max-w-full">
                {`claude mcp add mindraft --transport http ${mcpUrl}`}
              </pre>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Cursor / other MCP clients
              </p>
              <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {`{ "mcpServers": { "mindraft": { "url": "${mcpUrl}" } } }`}
              </pre>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            About
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/mcp"
                className="text-foreground hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                How to use AI agent with your ideas
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-foreground hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/lucascaro/mindraft"
                rel="noreferrer noopener"
                target="_blank"
                className="text-foreground hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                GitHub repository
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          </ul>
        </section>

        {/* Danger zone */}
        <section className="rounded-lg border border-destructive/30 bg-card p-5">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide mb-2">
            Danger zone
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account and every idea you&apos;ve
            saved. This cannot be undone. Export your data first if you
            want to keep it.
          </p>
          {error && (
            <p className="text-sm text-destructive mb-3" role="alert">
              {error}
            </p>
          )}
          {confirmingDelete ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="sm:flex-1"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Yes, delete everything
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(true)}
              className="w-full sm:w-auto text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete my account
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}
