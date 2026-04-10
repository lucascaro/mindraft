/**
 * OAuth 2.0 Token Endpoint
 *
 * Supports two grant types:
 *
 *   authorization_code — Exchanges a short-lived auth code (issued by
 *                        /api/oauth/callback) for a 1-hour JWT access token
 *                        AND a 30-day refresh token. Performs full PKCE S256
 *                        verification.
 *
 *   refresh_token      — Exchanges a valid refresh token for a new access
 *                        token + a rotated refresh token. Implements OAuth 2.1
 *                        rotation with reuse detection: presenting a token
 *                        twice revokes the entire family.
 *
 * Accepts application/x-www-form-urlencoded or application/json.
 */
import { codes } from "@/lib/server/oauth-store";
// Note: codes.consume() is used — it atomically deletes the code on first
// access, burning it even if PKCE verification subsequently fails.
import { pkceChallenge, safeEqual, signToken } from "@/lib/server/tokens";
import {
  issueRefreshToken,
  consumeAndRotateRefreshToken,
  RefreshTokenError,
} from "@/lib/server/refresh-tokens";
import { parseOAuthBody } from "@/lib/server/oauth-body";

export const dynamic = "force-dynamic";

const ACCESS_TOKEN_EXPIRES_IN = 60 * 60; // 1 hour

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function tokenResponse(accessToken: string, refreshToken: string): Response {
  return Response.json(
    {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_EXPIRES_IN,
      refresh_token: refreshToken,
    },
    { headers: NO_STORE_HEADERS },
  );
}

async function handleAuthorizationCode(body: Record<string, string>): Promise<Response> {
  const { code, code_verifier } = body;
  if (!code || !code_verifier) {
    return Response.json(
      { error: "invalid_request", error_description: "code and code_verifier required" },
      { status: 400 },
    );
  }

  // Atomically consume the code. The entry is deleted on first call regardless
  // of whether PKCE verification subsequently passes. This prevents replay
  // attacks even if the code was intercepted and presented simultaneously.
  const entry = await codes.consume(code);
  if (!entry) {
    return Response.json(
      { error: "invalid_grant", error_description: "Code expired or already used" },
      { status: 400 },
    );
  }

  // Verify PKCE S256: SHA-256(code_verifier) must match the stored challenge.
  // The code is already burned above — a failed check cannot be retried.
  if (!safeEqual(pkceChallenge(code_verifier), entry.challenge)) {
    return Response.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 },
    );
  }

  const accessToken = signToken(entry.uid);
  const { raw: refreshToken } = await issueRefreshToken(entry.uid, entry.clientName);
  return tokenResponse(accessToken, refreshToken);
}

async function handleRefreshToken(body: Record<string, string>): Promise<Response> {
  const refreshToken = body.refresh_token;
  if (!refreshToken) {
    return Response.json(
      { error: "invalid_request", error_description: "refresh_token required" },
      { status: 400 },
    );
  }

  try {
    const { uid, raw } = await consumeAndRotateRefreshToken(refreshToken);
    const accessToken = signToken(uid);
    return tokenResponse(accessToken, raw);
  } catch (e) {
    if (e instanceof RefreshTokenError) {
      return Response.json(
        { error: "invalid_grant", error_description: e.code },
        { status: 400 },
      );
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const body = await parseOAuthBody(req);

  switch (body.grant_type) {
    case "authorization_code":
      return handleAuthorizationCode(body);
    case "refresh_token":
      return handleRefreshToken(body);
    default:
      return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS" },
  });
}
