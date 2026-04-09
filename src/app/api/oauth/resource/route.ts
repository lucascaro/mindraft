/**
 * OAuth 2.0 Protected Resource Metadata
 * RFC 9728 — served at /.well-known/oauth-protected-resource via a rewrite in next.config.ts
 *
 * The MCP route returns a `resource_metadata` URL in its 401 response pointing here.
 * MCP clients follow it to discover the authorization server.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const metadata = {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: [],
    bearer_methods_supported: ["header"],
  };

  return Response.json(metadata, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
