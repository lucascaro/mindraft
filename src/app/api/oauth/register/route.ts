/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 *
 * MCP clients (e.g. Claude) call this endpoint to register themselves before
 * starting the authorization flow. We don't enforce per-client restrictions —
 * the authorize endpoint ignores client_id — so we simply echo back the
 * submitted metadata with a generated client_id.
 */
import { randomToken } from "@/lib/server/tokens";

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

  const clientId = randomToken(16);

  return Response.json(
    { ...body, client_id: clientId },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
