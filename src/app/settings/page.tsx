"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCrypto } from "@/lib/crypto-context";
import { exportAllIdeas } from "@/lib/firestore";
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
  const { encryptionEnabled, disableEncryption } = useCrypto();
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

  const handleExport = async () => {
    if (!user) return;
    setError(null);
    setExporting(true);
    try {
      const ideas = await exportAllIdeas(user.uid);
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

  const handleDisableEncryption = async () => {
    setEncryptionError(null);
    setDisablingEncryption(true);
    try {
      await disableEncryption(disablePassphrase);
      setConfirmingDisableEncryption(false);
      setDisablePassphrase("");
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

              {!confirmingDisableEncryption ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmingDisableEncryption(true);
                    setEncryptionError(null);
                  }}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  Disable encryption
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
                  <p className="text-sm text-muted-foreground">
                    Enter your passphrase to confirm. This will mark encryption
                    as disabled but{" "}
                    <strong className="text-foreground">
                      will not automatically decrypt your existing notes
                    </strong>
                    . Use the migration tool (coming soon) to restore plaintext.
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
                      onClick={handleDisableEncryption}
                      disabled={!disablePassphrase || disablingEncryption}
                    >
                      {disablingEncryption ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Disabling…
                        </>
                      ) : (
                        "Confirm disable"
                      )}
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
