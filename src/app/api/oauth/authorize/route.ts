/**
 * OAuth 2.0 Authorization Endpoint
 *
 * MCP clients redirect here to start the sign-in flow. This route validates
 * the redirect_uri against an allowlist, stores the PKCE state, and redirects
 * the user to /connect which renders the Google sign-in page.
 *
 * Expected query params (from the MCP client):
 *   response_type  — must be "code"
 *   code_challenge — base64url(SHA-256(code_verifier))
 *   redirect_uri   — where to send the code after sign-in (must be in allowlist)
 *   state          — opaque value the client uses to prevent CSRF
 *   client_id      — ignored (public client, no registration required)
 */
import { pkce } from "@/lib/server/pkce-store";
import { randomToken, verifyClientId } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

/**
 * Validates that the redirect_uri is an allowed destination.
 *
 * We allow localhost on any port (standard for native MCP clients that spin up
 * a local HTTP listener to receive the authorization code) and the app's own
 * origin (for future browser-based MCP clients).
 *
 * All other URIs are rejected to prevent auth-code theft via open redirect.
 * Add additional origins here only when a new verified MCP client is supported.
 */
function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  // Allow localhost / 127.0.0.1 on any port — standard for native MCP clients.
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    return true;
  }

  // Allow the app's own origin (for same-origin MCP client flows).
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (appOrigin) {
    try {
      if (parsed.origin === new URL(appOrigin).origin) return true;
    } catch { /* ignore */ }
  }

  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const responseType = url.searchParams.get("response_type");
  const challenge = url.searchParams.get("code_challenge");
  const challengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") ?? "";
  const clientId = url.searchParams.get("client_id") ?? "";

  if (responseType !== "code") {
    return Response.json({ error: "unsupported_response_type" }, { status: 400 });
  }
  if (!challenge) {
    return Response.json(
      { error: "invalid_request", error_description: "code_challenge required" },
      { status: 400 }
    );
  }
  if (challengeMethod !== "S256") {
    return Response.json(
      { error: "invalid_request", error_description: "only S256 is supported" },
      { status: 400 }
    );
  }
  if (!redirectUri) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uri required" },
      { status: 400 }
    );
  }
  // Check redirect_uri against the client's registered URIs (encoded in the
  // client_id JWT) first, then fall back to the static allowlist.
  const registeredUris = verifyClientId(clientId);
  const isAllowed = registeredUris
    ? registeredUris.includes(redirectUri)
    : isAllowedRedirectUri(redirectUri);

  if (!isAllowed) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uri not allowed" },
      { status: 400 }
    );
  }

  const sessionId = randomToken();
  try {
    pkce.set(sessionId, challenge, redirectUri, state);
  } catch {
    return Response.json(
      { error: "server_error", error_description: "Too many pending sessions. Try again later." },
      { status: 503 }
    );
  }

  // Redirect user to the /connect page, which renders the Google sign-in UI.
  const connectUrl = new URL("/connect", url.origin);
  connectUrl.searchParams.set("session", sessionId);

  return Response.redirect(connectUrl.toString(), 302);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET, OPTIONS" },
  });
}
