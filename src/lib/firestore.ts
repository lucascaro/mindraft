import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  deleteField,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { encryptIdea, decryptIdea } from "./crypto";
import type { Idea, FirestoreIdeaDoc } from "./types";

const COLLECTION = "ideas";
const PREFS_COLLECTION = "userPrefs";

// ── Encryption helpers ─────────────────────────────────────────────────────

/** Content fields that are encrypted in the envelope. */
const CONTENT_FIELDS = ["title", "body", "tags"] as const;

function hasContentFields(
  data: Record<string, unknown>
): boolean {
  return CONTENT_FIELDS.some((f) => f in data);
}

/**
 * Decrypt a batch of Firestore docs, handling both encrypted and plaintext.
 * When mk is null, encrypted docs get placeholder values.
 */
async function decryptDocs(
  docs: FirestoreIdeaDoc[],
  mk: CryptoKey | null
): Promise<Idea[]> {
  return Promise.all(
    docs.map(async (d) => {
      if (!d.encrypted) return d as unknown as Idea;
      if (!mk) {
        // Locked state: show placeholders
        const { encrypted: _, ...rest } = d;
        return {
          ...rest,
          title: "[encrypted]",
          body: "",
          tags: [],
        } as Idea;
      }
      return decryptIdea(mk, d);
    })
  );
}

type IdeaFilter = "active" | "archived";

function sortByCreatedAt(ideas: Idea[]) {
  return ideas.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

/** @internal exported for testing */
/**
 * Tier for three-tier sort:
 *  0 = refinement queue (refineNext === true)
 *  1 = new / unordered  (sortOrder is undefined)
 *  2 = manually ordered  (sortOrder is defined, not refineNext)
 */
function sortTier(idea: Idea): number {
  if (idea.refineNext) return 0;
  if (idea.sortOrder == null) return 1;
  return 2;
}

export function sortBySortOrder(ideas: Idea[]) {
  return ideas.sort((a, b) => {
    const aTier = sortTier(a);
    const bTier = sortTier(b);
    if (aTier !== bTier) return aTier - bTier;

    // Within refinement and ordered tiers: sort by sortOrder ascending
    if (aTier !== 1) {
      const aOrder = a.sortOrder ?? 0;
      const bOrder = b.sortOrder ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }

    // Within new tier (or same sortOrder): newest first
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

function sortByArchivedAt(ideas: Idea[]) {
  return ideas.sort((a, b) => {
    const aTime = a.archivedAt?.toMillis?.() ?? 0;
    const bTime = b.archivedAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

export function subscribeToIdeas(
  userId: string,
  callback: (ideas: Idea[]) => void,
  filter: IdeaFilter = "active",
  mk: CryptoKey | null = null
) {
  const q = query(
    collection(getDb(), COLLECTION),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const rawDocs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }) as FirestoreIdeaDoc);

    const filtered =
      filter === "active"
        ? rawDocs.filter((i) => !i.archived)
        : rawDocs.filter((i) => i.archived === true);

    decryptDocs(filtered, mk).then((ideas) => {
      if (filter === "active") {
        callback(sortBySortOrder(ideas));
      } else {
        callback(sortByArchivedAt(ideas));
      }
    });
  });
}

export async function addIdea(
  userId: string,
  title: string,
  body: string = "",
  mk: CryptoKey | null = null
) {
  // Pre-generate doc ID so we have it for AAD when encrypting
  const ref = doc(collection(getDb(), COLLECTION));

  const baseDoc = {
    status: "raw" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userId,
  };

  if (mk) {
    // Build a temp Idea for encryptIdea (needs id, title, body, tags, userId)
    const tempIdea = {
      id: ref.id,
      title,
      body,
      tags: [] as string[],
      userId,
    } as Idea;
    const encrypted = await encryptIdea(mk, tempIdea);
    // encrypted has { encrypted: {...}, ...rest } — extract just the envelope
    await setDoc(ref, {
      ...baseDoc,
      encrypted: encrypted.encrypted,
    });
  } else {
    await setDoc(ref, {
      ...baseDoc,
      title,
      body,
      tags: [],
    });
  }

  return { id: ref.id };
}

export async function updateIdea(
  id: string,
  data: Partial<Omit<Idea, "id" | "createdAt" | "userId">>,
  opts?: { mk?: CryptoKey | null; currentIdea?: Idea }
) {
  const ref = doc(getDb(), COLLECTION, id);
  const mk = opts?.mk ?? null;

  if (mk && hasContentFields(data) && opts?.currentIdea) {
    // Merge partial update into current idea, then encrypt the full envelope
    const merged: Idea = { ...opts.currentIdea, ...data };
    const encrypted = await encryptIdea(mk, merged);

    // Build update: non-content fields from data + encrypted envelope
    const nonContent: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!(CONTENT_FIELDS as readonly string[]).includes(key)) {
        nonContent[key] = value;
      }
    }

    return updateDoc(ref, {
      ...nonContent,
      encrypted: encrypted.encrypted,
      updatedAt: serverTimestamp(),
    });
  }

  return updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveIdea(id: string) {
  const ref = doc(getDb(), COLLECTION, id);
  return updateDoc(ref, {
    archived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreIdea(id: string) {
  const ref = doc(getDb(), COLLECTION, id);
  return updateDoc(ref, {
    archived: false,
    archivedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteIdea(id: string) {
  return deleteDoc(doc(getDb(), COLLECTION, id));
}

export async function reorderIdeas(updates: { id: string; sortOrder: number }[]) {
  const batch = writeBatch(getDb());
  for (const { id, sortOrder } of updates) {
    const ref = doc(getDb(), COLLECTION, id);
    batch.update(ref, { sortOrder, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

// ── Tag color overrides ──────────────────────────────────────────────────────

/** Subscribes to the user's tag→colorKey override map stored in userPrefs. */
export function subscribeToTagColors(
  userId: string,
  callback: (overrides: Record<string, string>) => void
) {
  const ref = doc(getDb(), PREFS_COLLECTION, userId);
  return onSnapshot(ref, (snap) => {
    const data = snap.data();
    callback((data?.tagColors as Record<string, string>) ?? {});
  });
}

/** Persists a single tag→colorKey override for the user. */
export async function setTagColor(
  userId: string,
  tag: string,
  colorKey: string
) {
  const ref = doc(getDb(), PREFS_COLLECTION, userId);
  return setDoc(ref, { tagColors: { [tag]: colorKey } }, { merge: true });
}

// ── Export / bulk operations ─────────────────────────────────────────────────

/**
 * One-shot fetch of every idea (active and archived) owned by the user.
 * Used by the data export feature in Settings. Sorted newest-first.
 */
export async function exportAllIdeas(
  userId: string,
  mk: CryptoKey | null = null
): Promise<Idea[]> {
  const q = query(
    collection(getDb(), COLLECTION),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  const rawDocs = snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as FirestoreIdeaDoc
  );
  const ideas = await decryptDocs(rawDocs, mk);
  return sortByCreatedAt(ideas);
}

/**
 * Permanently deletes every idea owned by the user. Used by the account
 * deletion flow before deleting the Auth user itself. Firestore batched
 * writes are capped at 500 ops; this chunks if needed.
 */
export async function deleteAllUserIdeas(userId: string): Promise<void> {
  const q = query(
    collection(getDb(), COLLECTION),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    for (const d of snap.docs.slice(i, i + CHUNK)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}
