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
import { Idea } from "./types";

const COLLECTION = "ideas";
const PREFS_COLLECTION = "userPrefs";

type IdeaFilter = "active" | "archived";

function sortByCreatedAt(ideas: Idea[]) {
  return ideas.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

/** @internal exported for testing */
export function sortBySortOrder(ideas: Idea[]) {
  return ideas.sort((a, b) => {
    // Primary sort: refineNext items float to top
    if (a.refineNext && !b.refineNext) return -1;
    if (!a.refineNext && b.refineNext) return 1;
    // Secondary sort: manual sortOrder
    const aOrder = a.sortOrder ?? Infinity;
    const bOrder = b.sortOrder ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Tertiary sort: newest first for ideas with same/no sortOrder
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
  filter: IdeaFilter = "active"
) {
  const q = query(
    collection(getDb(), COLLECTION),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }) as Idea);

    if (filter === "active") {
      callback(sortBySortOrder(all.filter((i) => !i.archived)));
    } else {
      callback(sortByArchivedAt(all.filter((i) => i.archived === true)));
    }
  });
}

export async function addIdea(
  userId: string,
  title: string,
  body: string = ""
) {
  return addDoc(collection(getDb(), COLLECTION), {
    title,
    body,
    tags: [],
    status: "raw",
    archived: false,
    sortOrder: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userId,
  });
}

export async function updateIdea(
  id: string,
  data: Partial<Omit<Idea, "id" | "createdAt" | "userId">>
) {
  const ref = doc(getDb(), COLLECTION, id);
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
export async function exportAllIdeas(userId: string): Promise<Idea[]> {
  const q = query(
    collection(getDb(), COLLECTION),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as Idea
  );
  return sortByCreatedAt(all);
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
