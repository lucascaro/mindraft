/**
 * OAuth 2.0 Token Revocation (RFC 7009)
 *
 * Clients call this endpoint to revoke a refresh token — for example, on
 * disconnect or sign-out. Accepts application/json or form-encoded bodies.
 *
 * Per RFC 7009 §2.2, the endpoint MUST respond with HTTP 200 for unknown or
 * invalid tokens to prevent token-status enumeration attacks. That's what we
 * do — any error is swallowed.
 *
 * Access tokens cannot be revoked (they are stateless JWTs). Passing one here
 * is still a 200 OK, but the token will remain valid until its JWT expiry.
 * Since access tokens are short-lived (1 h), this window is the documented
 * blast radius.
 */

import { revokeRefreshToken } from "@/lib/server/refresh-tokens";
import { parseOAuthBody } from "@/lib/server/oauth-body";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  const body = await parseOAuthBody(req);
  const token = body.token;

  if (token) {
    try {
      // token_type_hint is advisory; we only support refresh_token revocation,
      // so ignore the hint and attempt it regardless. Errors are swallowed per
      // RFC 7009 §2.2.
      await revokeRefreshToken(token);
    } catch (e) {
      console.warn("[oauth] revoke error (swallowed)", e);
    }
  }

  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
