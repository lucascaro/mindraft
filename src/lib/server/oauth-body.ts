/**
 * Shared body parser for OAuth POST endpoints.
 *
 * Accepts both application/json and application/x-www-form-urlencoded bodies
 * (OAuth 2.0 clients may send either — the MCP SDK historically sends
 * form-encoded).
 */

import "server-only";

export async function parseOAuthBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      return (await req.json()) as Record<string, string>;
    } catch {
      return {};
    }
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}
