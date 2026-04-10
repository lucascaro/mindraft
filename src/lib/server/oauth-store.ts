/**
 * Firestore-backed OAuth 2.0 ephemeral state.
 *
 * Two collections, both Admin-SDK-only (locked down by the catch-all deny in
 * firestore.rules):
 *
 *   oauthSessions — PKCE sessions created by /authorize and consumed by
 *                   /callback. Keyed by sessionId. 10 min TTL.
 *
 *   oauthCodes    — Auth codes created by /callback and consumed by /token.
 *                   Keyed by the raw code value (already random/unguessable).
 *                   5 min TTL. Single-use via a transactional consume().
 *
 * TTL policies are configured on `expiresAt` in the Firebase Console. They run
 * within ~24 h of expiry, so every read MUST re-check expiresAt explicitly —
 * TTL is purely an eventual cleanup mechanism.
 *
 * This replaces the in-memory pkce-store so the OAuth flow works correctly
 * across multiple serverless instances.
 */

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "./admin";

const SESSIONS_COLLECTION = "oauthSessions";
const CODES_COLLECTION = "oauthCodes";

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes for the sign-in flow
const CODE_TTL_MS = 5 * 60 * 1000;     // 5 minutes to exchange the code

export interface PkceEntry {
  challenge: string;
  redirectUri: string;
  state: string;
  clientName: string | null;
  expiresAt: number;
}

export interface CodeEntry {
  uid: string;
  challenge: string;
  clientName: string | null;
  expiresAt: number;
}

export const sessions = {
  async set(
    sessionId: string,
    challenge: string,
    redirectUri: string,
    state: string,
    clientName: string | null,
  ): Promise<void> {
    const db = getAdminDb();
    await db.collection(SESSIONS_COLLECTION).doc(sessionId).set({
      challenge,
      redirectUri,
      state,
      clientName,
      expiresAt: Timestamp.fromMillis(Date.now() + SESSION_TTL_MS),
    });
  },

  async get(sessionId: string): Promise<PkceEntry | null> {
    const db = getAdminDb();
    const doc = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    const expiresAt = (data.expiresAt as Timestamp).toMillis();
    if (expiresAt < Date.now()) {
      // Best-effort cleanup; TTL policy will also sweep it.
      await db.collection(SESSIONS_COLLECTION).doc(sessionId).delete();
      return null;
    }
    return {
      challenge: data.challenge,
      redirectUri: data.redirectUri,
      state: data.state,
      clientName: data.clientName ?? null,
      expiresAt,
    };
  },

  async delete(sessionId: string): Promise<void> {
    const db = getAdminDb();
    await db.collection(SESSIONS_COLLECTION).doc(sessionId).delete();
  },
};

export const codes = {
  async set(
    code: string,
    uid: string,
    challenge: string,
    clientName: string | null,
  ): Promise<void> {
    const db = getAdminDb();
    await db.collection(CODES_COLLECTION).doc(code).set({
      uid,
      challenge,
      clientName,
      expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS),
    });
  },

  /**
   * Atomically retrieves and deletes a code entry (single-use).
   *
   * The delete happens inside the same transaction as the read so a failed
   * PKCE check at the caller still burns the code, preventing brute-force
   * enumeration. If the caller's PKCE check fails after this returns, they
   * must restart the authorization flow.
   */
  async consume(code: string): Promise<CodeEntry | null> {
    const db = getAdminDb();
    const ref = db.collection(CODES_COLLECTION).doc(code);
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      // Always delete on touch — matches the "burn on touch" semantics of the
      // previous in-memory store.
      tx.delete(ref);
      const data = doc.data()!;
      const expiresAt = (data.expiresAt as Timestamp).toMillis();
      if (expiresAt < Date.now()) return null;
      return {
        uid: data.uid,
        challenge: data.challenge,
        clientName: data.clientName ?? null,
        expiresAt,
      };
    });
  },
};
