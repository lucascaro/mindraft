/**
 * JWT utilities for MCP access tokens.
 *
 * Access tokens are short-lived (24 h) JWTs signed with MCP_JWT_SECRET.
 * They carry only the Firebase UID — nothing else is needed.
 */

import "server-only";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

// 1 hour — short enough to limit blast radius if a token is stolen, while
// still being long enough that normal agent sessions don't need to re-auth.
// MCP clients automatically re-authorize when they receive a 401.
const EXPIRY_SECONDS = 60 * 60;

function getSecret(): string {
  const secret = process.env.MCP_JWT_SECRET;
  if (!secret) throw new Error("MCP_JWT_SECRET is not set");
  // Enforce minimum entropy: 32 characters ≈ 192 bits when hex, or ~256 bits
  // when base64url. A short secret can be brute-forced offline from any signed JWT.
  if (secret.length < 32) {
    throw new Error(
      "MCP_JWT_SECRET must be at least 32 characters. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

export function signToken(uid: string): string {
  return jwt.sign({ uid }, getSecret(), {
    expiresIn: EXPIRY_SECONDS,
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "object" && typeof payload.uid === "string") {
      return payload.uid;
    }
    return null;
  } catch {
    return null;
  }
}

/** Extracts the Bearer token from an Authorization header value. */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/** SHA-256 of the code_verifier, base64url-encoded (PKCE S256). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64url");
}

/**
 * Timing-safe string equality for security-sensitive comparisons.
 * Uses constant-time comparison to prevent timing side-channel attacks.
 */
export function safeEqual(a: string, b: string): boolean {
  // timingSafeEqual requires equal-length buffers.
  // If lengths differ we still return false, but we do a dummy comparison
  // to avoid leaking length information via timing.
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // Perform a comparison anyway to consume similar time
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** Generates a cryptographically secure random string. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Signs a set of redirect_uris into a client_id JWT.
 *
 * This makes client registration stateless: instead of storing registrations
 * in a database, we encode the allowed redirect_uris directly into the
 * client_id. The authorize endpoint verifies the signature and trusts whatever
 * URIs were registered, so any MCP client works without a per-client allowlist.
 */
export interface ClientInfo {
  redirectUris: string[];
  clientName: string | undefined;
}

export function signClientId(info: ClientInfo): string {
  return jwt.sign(
    { redirect_uris: info.redirectUris, client_name: info.clientName },
    getSecret(),
    { algorithm: "HS256" }
  );
}

/**
 * Verifies a client_id JWT and returns its ClientInfo, or null if invalid.
 */
export function verifyClientId(clientId: string): ClientInfo | null {
  try {
    const payload = jwt.verify(clientId, getSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "object" && Array.isArray(payload.redirect_uris)) {
      return {
        redirectUris: payload.redirect_uris as string[],
        clientName: typeof payload.client_name === "string" ? payload.client_name : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}
