/**
 * Returns non-sensitive metadata about a pending OAuth session.
 * Used by the /connect page to show the requesting client's name.
 *
 * Only clientName is exposed — the PKCE challenge and redirectUri
 * are never sent to the browser.
 */
import { pkce } from "@/lib/server/pkce-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get("session");
  if (!session) {
    return Response.json({ error: "missing session" }, { status: 400 });
  }

  const entry = pkce.get(session);
  if (!entry) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  return Response.json({ clientName: entry.clientName ?? null });
}
