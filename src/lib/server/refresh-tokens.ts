/**
 * OAuth 2.1 refresh tokens with rotation and reuse detection.
 *
 * Storage model:
 *   refreshTokens/{sha256(rawToken) hex}  — one doc per issued token.
 *                                           Soft-revoked only; never hard-deleted
 *                                           so reuse can be detected forever.
 *   refreshTokenFamilies/{familyId}       — one doc per authorization grant.
 *                                           All tokens rotated from the same
 *                                           grant share a familyId. Revoking
 *                                           the family revokes every token in it.
 *
 * The raw token never leaves this module except as a return value to the
 * OAuth token endpoint. Only the SHA-256 hash is persisted, so a database
 * breach does not yield usable tokens.
 *
 * Rotation preserves the family's absoluteExpiresAt — the 30-day cap is NEVER
 * extended by refreshing, which bounds the blast radius of a leaked token.
 *
 * Reuse detection: if the same refresh token is used twice, the entire family
 * is revoked. This catches the "attacker cloned the token" scenario: whoever
 * presents the already-rotated token second loses everyone in the family.
 */

import "server-only";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./admin";
import { randomToken, hashToken, REFRESH_TOKEN_TTL_MS } from "./tokens";

const TOKENS_COLLECTION = "refreshTokens";
const FAMILIES_COLLECTION = "refreshTokenFamilies";

export type RefreshTokenErrorCode = "invalid" | "expired" | "reused";

export class RefreshTokenError extends Error {
  constructor(public code: RefreshTokenErrorCode) {
    super(code);
    this.name = "RefreshTokenError";
  }
}

interface RefreshTokenDoc {
  uid: string;
  familyId: string;
  clientName: string | null;
  issuedAt: Timestamp;
  absoluteExpiresAt: Timestamp;
  revokedAt: Timestamp | null;
  replacedByTokenHash: string | null;
  rotationCount: number;
}

interface FamilyDoc {
  uid: string;
  clientName: string | null;
  createdAt: Timestamp;
  absoluteExpiresAt: Timestamp;
  revoked: boolean;
  revokedReason: string | null;
}

/**
 * Issues a brand-new refresh token and its family.
 *
 * Called from the /token endpoint after a successful `authorization_code` grant.
 * Returns the raw token (to be handed to the client) — it is never stored.
 */
export async function issueRefreshToken(
  uid: string,
  clientName: string | null,
): Promise<{ raw: string; familyId: string; absoluteExpiresAt: Timestamp }> {
  const db = getAdminDb();
  const raw = randomToken(32);
  const hash = hashToken(raw);
  const familyId = randomToken(16);
  const now = Date.now();
  const absoluteExpiresAt = Timestamp.fromMillis(now + REFRESH_TOKEN_TTL_MS);
  const createdAt = Timestamp.fromMillis(now);

  const batch = db.batch();
  batch.set(db.collection(FAMILIES_COLLECTION).doc(familyId), {
    uid,
    clientName,
    createdAt,
    absoluteExpiresAt,
    revoked: false,
    revokedReason: null,
  } satisfies FamilyDoc);
  batch.set(db.collection(TOKENS_COLLECTION).doc(hash), {
    uid,
    familyId,
    clientName,
    issuedAt: createdAt,
    absoluteExpiresAt,
    revokedAt: null,
    replacedByTokenHash: null,
    rotationCount: 0,
  } satisfies RefreshTokenDoc);
  await batch.commit();

  return { raw, familyId, absoluteExpiresAt };
}

/**
 * Atomically consumes a refresh token and issues its rotated successor.
 *
 * Throws RefreshTokenError on any failure mode. If reuse is detected
 * (presenting an already-rotated token), the entire family is revoked as a
 * follow-up step after the transaction commits.
 */
export async function consumeAndRotateRefreshToken(
  rawToken: string,
): Promise<{ uid: string; raw: string }> {
  const db = getAdminDb();
  const currentHash = hashToken(rawToken);
  const currentRef = db.collection(TOKENS_COLLECTION).doc(currentHash);

  // Reuse-detection cleanup state. Set inside the transaction on reuse and
  // acted on after the transaction commits (cannot do 500-write family
  // batch inside the transactional scope).
  let reuseFamilyId: string | null = null;
  let reuseUid: string | null = null;

  let result: { uid: string; raw: string };
  try {
    result = await db.runTransaction(async (tx) => {
      const now = Date.now();
      const doc = await tx.get(currentRef);
      if (!doc.exists) {
        // Unknown token. We never hard-delete, so this means the caller is
        // presenting a token we never issued (or one that was so old it was
        // swept by TTL policy — also functionally invalid).
        throw new RefreshTokenError("invalid");
      }
      const data = doc.data() as RefreshTokenDoc;

      if (data.revokedAt !== null) {
        // Reuse of an already-rotated token. Revoke the family after commit.
        reuseFamilyId = data.familyId;
        reuseUid = data.uid;
        throw new RefreshTokenError("reused");
      }

      if (data.absoluteExpiresAt.toMillis() < now) {
        throw new RefreshTokenError("expired");
      }

      // Generate the new token INSIDE the callback so transaction retries on
      // contention produce a fresh token, not a stale one.
      const newRaw = randomToken(32);
      const newHash = hashToken(newRaw);
      const newRef = db.collection(TOKENS_COLLECTION).doc(newHash);

      tx.update(currentRef, {
        revokedAt: Timestamp.fromMillis(now),
        replacedByTokenHash: newHash,
      });
      tx.set(newRef, {
        uid: data.uid,
        familyId: data.familyId,
        clientName: data.clientName,
        issuedAt: Timestamp.fromMillis(now),
        // Absolute expiry is NEVER extended on rotation.
        absoluteExpiresAt: data.absoluteExpiresAt,
        revokedAt: null,
        replacedByTokenHash: null,
        rotationCount: data.rotationCount + 1,
      } satisfies RefreshTokenDoc);

      return { uid: data.uid, raw: newRaw };
    });
  } catch (e) {
    // On reuse detection, trigger the family-wide revocation before rethrowing
    // so the attacker's (and now also the victim's) remaining tokens are dead.
    if (e instanceof RefreshTokenError && e.code === "reused" && reuseFamilyId) {
      console.warn(
        `[oauth] refresh token reuse detected family=${reuseFamilyId} uid=${reuseUid}`,
      );
      try {
        await revokeFamily(reuseFamilyId, "reuse_detected");
      } catch (err) {
        console.error("[oauth] failed to revoke family after reuse", err);
      }
    }
    throw e;
  }

  return result;
}

/**
 * Revokes a single refresh token by raw value. Idempotent — safe to call on
 * unknown or already-revoked tokens.
 *
 * Used by the /revoke (RFC 7009) endpoint.
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const db = getAdminDb();
  const hash = hashToken(rawToken);
  const ref = db.collection(TOKENS_COLLECTION).doc(hash);
  const doc = await ref.get();
  if (!doc.exists) return; // Unknown token — idempotent no-op.
  const data = doc.data() as RefreshTokenDoc;
  if (data.revokedAt !== null) return; // Already revoked.
  await ref.update({
    revokedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Revokes every non-revoked token in a family and marks the family doc as
 * revoked. Idempotent — safe to call repeatedly.
 *
 * Used when reuse is detected, and can be called directly to sign out all
 * sessions derived from a particular authorization grant.
 *
 * Uses the (familyId, revokedAt) composite index defined in firestore.indexes.json.
 */
export async function revokeFamily(familyId: string, reason: string): Promise<void> {
  const db = getAdminDb();

  // Find all live tokens in the family.
  const snap = await db
    .collection(TOKENS_COLLECTION)
    .where("familyId", "==", familyId)
    .where("revokedAt", "==", null)
    .get();

  // Firestore batches max out at 500 writes. For the family doc + a large
  // family, chunk the updates.
  const now = FieldValue.serverTimestamp();
  const docs = snap.docs;
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.update(d.ref, { revokedAt: now });
    }
    await batch.commit();
  }

  // Mark the family doc revoked. Use set with merge so this works even if the
  // family doc was somehow missing (defensive — should not happen in practice).
  await db.collection(FAMILIES_COLLECTION).doc(familyId).set(
    { revoked: true, revokedReason: reason },
    { merge: true },
  );
}
