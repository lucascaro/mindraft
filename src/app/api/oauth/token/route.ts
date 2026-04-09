/**
 * OAuth 2.0 Token Endpoint
 *
 * Exchanges a short-lived auth code (issued by /api/oauth/callback) for a
 * 24-hour JWT access token. Performs full PKCE S256 verification.
 *
 * Accepts application/x-www-form-urlencoded or application/json.
 *
 * Required fields:
 *   grant_type     — must be "authorization_code"
 *   code           — the auth code from the callback redirect
 *   code_verifier  — the PKCE verifier (client stored this before the flow)
 */
import { codes } from "@/lib/server/pkce-store";
// Note: codes.consume() is used — it atomically deletes the code on first
// access, burning it even if PKCE verification subsequently fails.
import { pkceChallenge, safeEqual, signToken } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

async function parseBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return req.json();
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(req: Request) {
  const body = await parseBody(req);
  const { grant_type, code, code_verifier } = body;

  if (grant_type !== "authorization_code") {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  }
  if (!code || !code_verifier) {
    return Response.json(
      { error: "invalid_request", error_description: "code and code_verifier required" },
      { status: 400 }
    );
  }

  // Atomically consume the code. The entry is deleted on first call regardless
  // of whether PKCE verification subsequently passes. This prevents replay
  // attacks even if the code was intercepted and presented simultaneously.
  const entry = codes.consume(code);
  if (!entry) {
    return Response.json(
      { error: "invalid_grant", error_description: "Code expired or already used" },
      { status: 400 }
    );
  }

  // Verify PKCE S256: SHA-256(code_verifier) must match the stored challenge.
  // The code is already burned above — a failed check cannot be retried.
  if (!safeEqual(pkceChallenge(code_verifier), entry.challenge)) {
    return Response.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 }
    );
  }

  const accessToken = signToken(entry.uid);

  return Response.json(
    {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 60 * 60, // 1 hour
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS" },
  });
}
