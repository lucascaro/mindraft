/**
 * OAuth 2.0 Authorization Server Metadata
 * RFC 8414 — served at /.well-known/oauth-authorization-server via a rewrite in next.config.ts
 *
 * MCP clients discover this endpoint automatically after reading the
 * resource metadata returned by /api/oauth/resource.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const metadata = {
    issuer: base,
    authorization_endpoint: `${base}/connect`,
    token_endpoint: `${base}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };

  return Response.json(metadata, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
