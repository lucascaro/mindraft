/**
 * In-memory stores for the OAuth 2.0 PKCE flow.
 *
 * PkceStore maps a session ID → {challenge, redirectUri, state} while the user
 * is on the /connect page signing in.
 *
 * AuthCodeStore maps a short-lived auth code → {uid, challenge, expiresAt} after
 * sign-in succeeds but before the MCP client has exchanged the code for a token.
 *
 * Both stores auto-expire entries to prevent memory growth. Hard size caps prevent
 * unauthenticated callers from exhausting memory via the /api/oauth/authorize endpoint.
 *
 * NOTE: This is intentionally in-memory and single-process. For multi-instance
 * deployments, replace with a shared atomic store (e.g. Firestore or Redis)
 * and ensure the consume() operation is transactional.
 */

import "server-only";

interface PkceEntry {
  challenge: string;
  redirectUri: string;
  state: string;
  expiresAt: number;
}

interface CodeEntry {
  uid: string;
  challenge: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes for the sign-in flow
const CODE_TTL_MS = 5 * 60 * 1000;     // 5 minutes to exchange the code

// Hard size caps to prevent DoS via unauthenticated flooding of /api/oauth/authorize.
const MAX_PKCE_ENTRIES = 10_000;
const MAX_CODE_ENTRIES = 10_000;

const pkceStore = new Map<string, PkceEntry>();
const codeStore = new Map<string, CodeEntry>();

function purgeExpired<T extends { expiresAt: number }>(map: Map<string, T>) {
  const now = Date.now();
  for (const [key, val] of map) {
    if (val.expiresAt < now) map.delete(key);
  }
}

export const pkce = {
  set(sessionId: string, challenge: string, redirectUri: string, state: string) {
    purgeExpired(pkceStore);
    if (pkceStore.size >= MAX_PKCE_ENTRIES) {
      throw new Error("Too many pending sessions");
    }
    pkceStore.set(sessionId, {
      challenge,
      redirectUri,
      state,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  },
  get(sessionId: string): PkceEntry | undefined {
    const entry = pkceStore.get(sessionId);
    if (!entry || entry.expiresAt < Date.now()) {
      pkceStore.delete(sessionId);
      return undefined;
    }
    return entry;
  },
  delete(sessionId: string) {
    pkceStore.delete(sessionId);
  },
};

export const codes = {
  set(code: string, uid: string, challenge: string) {
    purgeExpired(codeStore);
    if (codeStore.size >= MAX_CODE_ENTRIES) {
      throw new Error("Too many pending codes");
    }
    codeStore.set(code, { uid, challenge, expiresAt: Date.now() + CODE_TTL_MS });
  },

  /**
   * Atomically retrieves and deletes a code entry (single-use).
   *
   * The delete happens BEFORE PKCE verification so that a failed attempt (wrong
   * code_verifier) still burns the code, preventing brute-force enumeration.
   * If the caller's PKCE check fails after this returns, they must restart the
   * authorization flow.
   */
  consume(code: string): CodeEntry | undefined {
    const entry = codeStore.get(code);
    // Delete immediately — before returning — to prevent any replay window.
    codeStore.delete(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return undefined;
    }
    return entry;
  },
};
