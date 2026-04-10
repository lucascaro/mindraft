"use client";

/**
 * /connect — OAuth authorization page.
 *
 * Users are redirected here by their MCP client when connecting to mindraft.
 * They sign in with Google via signInWithRedirect (more reliable than popup
 * when the page is reached via an OAuth redirect chain), then this page posts
 * their Firebase ID token to /api/oauth/callback, which issues the auth code
 * and redirects the browser back to the MCP client.
 *
 * URL params:
 *   session — opaque session ID linking back to the PKCE state
 *
 * Because signInWithRedirect navigates away from this page, the session ID is
 * stored in sessionStorage before leaving and restored on return.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithRedirect, getRedirectResult, getIdToken } from "firebase/auth";
import { getAuthInstance, googleProvider } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Bot } from "lucide-react";

const SESSION_KEY = "mcp_oauth_session";

type State =
  | { kind: "idle" }
  | { kind: "signing-in" }
  | { kind: "connecting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  // On mount: pick up session from URL or from sessionStorage (post-redirect).
  useEffect(() => {
    const urlSession = searchParams.get("session");
    if (urlSession) {
      sessionStorage.setItem(SESSION_KEY, urlSession);
      setSession(urlSession);
    } else {
      const stored = sessionStorage.getItem(SESSION_KEY);
      setSession(stored);
    }
  }, [searchParams]);

  // After Google redirects back, complete the sign-in and exchange the token.
  useEffect(() => {
    if (session === null) return; // still initialising

    getRedirectResult(getAuthInstance())
      .then(async (result) => {
        if (!result) return; // no redirect in progress — normal page load
        setState({ kind: "connecting" });

        const storedSession = sessionStorage.getItem(SESSION_KEY);
        if (!storedSession) {
          setState({ kind: "error", message: "Session expired. Please retry from your AI agent." });
          return;
        }

        const idToken = await getIdToken(result.user, /* forceRefresh */ true);
        const res = await fetch("/api/oauth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, session: storedSession }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error_description ?? body.error ?? "Connection failed");
        }

        sessionStorage.removeItem(SESSION_KEY);
        const { redirectUrl } = await res.json();
        setState({ kind: "done" });
        window.location.href = redirectUrl;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Something went wrong";
        setState({ kind: "error", message });
      });
  }, [session]);

  // Validate session before showing the button.
  useEffect(() => {
    if (session === null) return; // still initialising
    if (!session) {
      setState({ kind: "error", message: "Invalid link — no session ID. Please retry from your AI agent." });
    }
  }, [session]);

  async function handleConnect() {
    if (!session) return;
    setState({ kind: "signing-in" });
    // Store session before navigating away so it survives the redirect.
    sessionStorage.setItem(SESSION_KEY, session);
    await signInWithRedirect(getAuthInstance(), googleProvider);
  }

  const isLoading = state.kind === "signing-in" || state.kind === "connecting" || state.kind === "done";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 bg-gradient-to-b from-background via-background to-primary/5">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <div className="relative">
              <Lightbulb className="h-7 w-7 text-primary" />
              <Bot className="absolute -bottom-1 -right-2 h-4 w-4 text-primary/70" />
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1.5">Mindraft</div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Connect your AI agent
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Sign in to allow your AI agent to read and manage your ideas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "error" ? (
            <p className="text-sm text-destructive text-center rounded-md bg-destructive/10 px-3 py-2">
              {state.message}
            </p>
          ) : state.kind === "done" ? (
            <p className="text-sm text-center text-muted-foreground">
              Connected! Redirecting back to your agent…
            </p>
          ) : (
            <Button
              onClick={handleConnect}
              className="w-full"
              size="lg"
              disabled={isLoading || !session}
            >
              {state.kind === "signing-in"
                ? "Signing in…"
                : state.kind === "connecting"
                  ? "Connecting…"
                  : "Sign in with Google"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Your ideas are only accessible to you. This connection uses your existing Mindraft account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
