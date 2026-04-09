/**
 * Firestore CRUD operations via Firebase Admin SDK.
 *
 * Every function accepts `userId` as its first parameter. This value always
 * comes from the verified JWT in the MCP route — never from agent tool input.
 *
 * Timestamps are serialized to ISO-8601 strings before being returned so that
 * MCP tool responses are plain JSON (Firestore Timestamp objects are not
 * serializable by JSON.stringify).
 */

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./admin";

const COLLECTION = "ideas";

export type IdeaStatus = "raw" | "in-progress" | "developed";

export interface SerializedIdea {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: IdeaStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  archivedAt?: string;
}

// Lightweight summary — no body — for list operations.
export type IdeaSummary = Omit<SerializedIdea, "body">;

function serialize(id: string, data: FirebaseFirestore.DocumentData): SerializedIdea {
  return {
    id,
    title: data.title,
    body: data.body ?? "",
    tags: data.tags ?? [],
    status: data.status ?? "raw",
    userId: data.userId,
    createdAt: data.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    ...(data.archived ? { archived: true } : {}),
    ...(data.archivedAt ? { archivedAt: data.archivedAt.toDate().toISOString() } : {}),
  };
}

export interface ListIdeasOptions {
  status?: IdeaStatus;
  tag?: string;
  search?: string;
  limit?: number;
}

export async function listIdeas(userId: string, opts: ListIdeasOptions = {}): Promise<IdeaSummary[]> {
  const db = getAdminDb();
  let q: FirebaseFirestore.Query = db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .where("archived", "==", false);

  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.tag) q = q.where("tags", "array-contains", opts.tag);

  const snap = await q.orderBy("createdAt", "desc").limit(opts.limit ?? 50).get();
  let results = snap.docs.map((d) => {
    const full = serialize(d.id, d.data());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { body: _, ...summary } = full;
    return summary;
  });

  if (opts.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((i) => i.title.toLowerCase().includes(q));
  }

  return results;
}

export async function listArchivedIdeas(userId: string, limit = 50): Promise<IdeaSummary[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .where("archived", "==", true)
    .orderBy("archivedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const full = serialize(d.id, d.data());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { body: _, ...summary } = full;
    return summary;
  });
}

export async function getIdea(userId: string, id: string): Promise<SerializedIdea | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  // Defense-in-depth: verify ownership even though the id came from a list result.
  if (data.userId !== userId) return null;
  return serialize(doc.id, data);
}

export async function createIdea(
  userId: string,
  title: string,
  body = "",
  tags: string[] = []
): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection(COLLECTION).add({
    userId,
    title,
    body,
    tags,
    status: "raw" as IdeaStatus,
    archived: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export interface UpdateIdeaData {
  title?: string;
  body?: string;
  tags?: string[];
  status?: IdeaStatus;
}

export async function updateIdea(
  userId: string,
  id: string,
  data: UpdateIdeaData
): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()!.userId !== userId) return false;
  await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() });
  return true;
}

export async function archiveIdea(userId: string, id: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()!.userId !== userId) return false;
  await ref.update({
    archived: true,
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

export async function restoreIdea(userId: string, id: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()!.userId !== userId) return false;
  await ref.update({
    archived: false,
    archivedAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

export async function deleteIdea(userId: string, id: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()!.userId !== userId) return false;
  await ref.delete();
  return true;
}

export async function searchIdeas(userId: string, query: string, limit = 50): Promise<IdeaSummary[]> {
  const db = getAdminDb();
  // Fetch all active ideas for the user and filter in-memory.
  // Firestore does not support full-text search natively.
  // For large collections, consider Algolia or Typesense.
  // Cap Firestore reads to 500 documents to prevent excessive memory allocation
  // and billing for users with very large collections.
  const snap = await db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .where("archived", "==", false)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  const q = query.toLowerCase();
  const results: IdeaSummary[] = [];
  const titleMatches: IdeaSummary[] = [];
  const bodyMatches: IdeaSummary[] = [];

  for (const d of snap.docs) {
    const full = serialize(d.id, d.data());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { body, ...summary } = full;
    if (full.title.toLowerCase().includes(q)) {
      titleMatches.push(summary);
    } else if (body.toLowerCase().includes(q)) {
      bodyMatches.push(summary);
    }
  }

  results.push(...titleMatches, ...bodyMatches);
  return results.slice(0, limit);
}
