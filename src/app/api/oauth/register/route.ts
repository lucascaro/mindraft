/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 *
 * MCP clients call this endpoint to register themselves before starting the
 * authorization flow. Rather than storing registrations in a database, we encode
 * the client's redirect_uris into a signed JWT and return it as the client_id.
 * The authorize endpoint verifies the signature and allows whatever URIs were
 * registered — so any MCP client works without a per-client allowlist.
 */
import { signClientId } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === "string")
    : [];

  const clientId = signClientId(redirectUris);

  return Response.json(
    { ...body, client_id: clientId },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
