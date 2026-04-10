/**
 * OAuth callback — called by the /connect page after Google sign-in.
 *
 * The /connect page gets a Firebase ID token client-side and POSTs it here.
 * This route verifies the token with Firebase Admin SDK, generates a short-lived
 * auth code, and returns the redirect URL for the browser to follow.
 *
 * POST body (JSON): { idToken: string, session: string }
 *
 * Response (JSON):
 *   { redirectUrl: string }  — the browser should navigate to this URL
 *   or { error: string }     — something went wrong
 */
import { getAdminAuth } from "@/lib/server/admin";
import { sessions, codes } from "@/lib/server/oauth-store";
import { randomToken } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { idToken?: string; session?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request", error_description: "Expected JSON body" }, { status: 400 });
  }

  const { idToken, session } = body;
  if (!idToken || !session) {
    return Response.json({ error: "invalid_request", error_description: "idToken and session required" }, { status: 400 });
  }

  // Resolve the PKCE session.
  const entry = await sessions.get(session);
  if (!entry) {
    return Response.json({ error: "invalid_request", error_description: "Session expired or invalid" }, { status: 400 });
  }

  // Verify the Firebase ID token.
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return Response.json({ error: "access_denied", error_description: "Invalid ID token" }, { status: 401 });
  }

  // Issue a short-lived auth code, carrying the challenge for PKCE verification
  // at token-exchange time. Also carry clientName so the refresh token issued
  // later can record which client it belongs to. Clean up the PKCE session.
  const code = randomToken();
  try {
    await codes.set(code, uid, entry.challenge, entry.clientName);
  } catch (e) {
    console.error("[oauth] failed to persist auth code", e);
    return Response.json({ error: "server_error", error_description: "Server error. Try again." }, { status: 500 });
  }
  await sessions.delete(session);

  // Build the redirect URL for the browser.
  const redirectUrl = new URL(entry.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (entry.state) redirectUrl.searchParams.set("state", entry.state);

  return Response.json({ redirectUrl: redirectUrl.toString() });
}
