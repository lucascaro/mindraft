/**
 * Mindraft MCP endpoint — Streamable HTTP transport.
 *
 * Auth: OAuth 2.0 Bearer token (JWT issued by /api/oauth/token).
 * A 401 with resource_metadata tells MCP clients where to find the OAuth server.
 *
 * Each request creates a fresh, stateless McpServer. This is the correct
 * pattern for Streamable HTTP — no persistent session state is required.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { extractBearer, verifyToken } from "@/lib/server/tokens";
import { registerMcpTools } from "@/lib/server/mcp-tools";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${APP_URL}/.well-known/oauth-protected-resource"`,
    },
  });
}

async function handleMcp(req: Request, userId: string): Promise<Response> {
  const server = new McpServer({ name: "mindraft", version: "1.0.0" });
  registerMcpTools(server, userId);

  // Stateless mode: no session ID, no persistent state between requests.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Allow JSON responses in addition to SSE so simple tools work without streaming.
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req, { authInfo: { token: "", clientId: "", scopes: [] } });
}

export async function POST(req: Request) {
  const userId = verifyToken(extractBearer(req.headers.get("Authorization")) ?? "");
  if (!userId) return unauthorized();
  return handleMcp(req, userId);
}

export async function GET(req: Request) {
  const userId = verifyToken(extractBearer(req.headers.get("Authorization")) ?? "");
  if (!userId) return unauthorized();
  return handleMcp(req, userId);
}

export async function DELETE(req: Request) {
  const userId = verifyToken(extractBearer(req.headers.get("Authorization")) ?? "");
  if (!userId) return unauthorized();
  return handleMcp(req, userId);
}

// CORS preflight.
//
// MCP clients such as Claude Desktop and Cursor are native applications — they
// do NOT use browser CORS. This handler exists only for future browser-based MCP
// clients. We restrict Allow-Origin to the app's own origin rather than "*"
// so that an attacker page cannot trigger MCP tool calls cross-origin even if
// it somehow obtains a valid Bearer token.
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Allow only the app's own origin, or localhost for local dev clients.
  const isAllowed =
    (appOrigin && origin === new URL(appOrigin).origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Origin": isAllowed ? origin : "null",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      Vary: "Origin",
    },
  });
}
