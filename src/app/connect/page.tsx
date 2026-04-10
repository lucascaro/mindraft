"use client";

/**
 * /connect — OAuth authorization page.
 *
 * Users are redirected here by their MCP client when connecting to mindraft.
 * If they are already signed in to the main app (same origin, same Firebase
 * project), we reuse their existing session — no new sign-in required. We
 * post their ID token to /api/oauth/callback, which issues the auth code and
 * redirects the browser back to the MCP client.
 *
 * If they are not signed in, we redirect them to the main app's sign-in page,
 * which preserves this URL so they come back here after signing in.
 *
 * URL params:
 *   session — opaque session ID linking back to the PKCE state
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, getIdToken, type User } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Bot } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "ready"; user: User; clientName: string | null }
  | { kind: "connecting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

async function completeConnection(user: User, session: string): Promise<string> {
  const idToken = await getIdToken(user, /* forceRefresh */ true);
  const res = await fetch("/api/oauth/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, session }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_description ?? body.error ?? "Connection failed");
  }
  const { redirectUrl } = await res.json();
  return redirectUrl;
}

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!session) {
      setState({ kind: "error", message: "Invalid link — no session ID. Please retry from your AI agent." });
      return;
    }

    // Wait for Firebase to restore the auth state from the existing session.
    const unsubscribe = onAuthStateChanged(getAuthInstance(), async (user) => {
      unsubscribe(); // only need the first resolved state

      if (!user) {
        // Not signed in — send them to the login page, which will redirect back here.
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`;
        return;
      }

      // Fetch client name from the server — don't trust URL params, they're forgeable.
      let clientName: string | null = null;
      try {
        const info = await fetch(`/api/oauth/session-info?session=${encodeURIComponent(session)}`);
        if (info.ok) clientName = (await info.json()).clientName ?? null;
      } catch { /* non-fatal — we'll show a generic label */ }

      // Signed in — show the confirmation button. Don't connect yet.
      setState({ kind: "ready", user, clientName });
    });

    return unsubscribe;
  }, [session]);

  async function handleConnect() {
    if (state.kind !== "ready" || !session) return;
    const { user } = state;
    setState({ kind: "connecting" });
    try {
      const redirectUrl = await completeConnection(user, session);
      setState({ kind: "done" });
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setState({ kind: "error", message });
    }
  }

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
            Allow your AI agent to read and manage your ideas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "error" ? (
            <p className="text-sm text-destructive text-center rounded-md bg-destructive/10 px-3 py-2">
              {state.message}
            </p>
          ) : state.kind === "ready" ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                <span className="font-medium text-foreground">
                  {state.clientName ?? "An AI agent"}
                </span>{" "}
                is requesting access to your ideas.
              </p>
              <p className="text-sm text-center text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{state.user.email}</span>
              </p>
              <Button onClick={handleConnect} className="w-full" size="lg">
                Connect
              </Button>
            </>
          ) : (
            <p className="text-sm text-center text-muted-foreground">
              {state.kind === "loading" ? "Checking your session…"
                : state.kind === "connecting" ? "Connecting…"
                : "Connected! Redirecting back to your agent…"}
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Your ideas are only accessible to you. This connection uses your existing Mindraft account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
