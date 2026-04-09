import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
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

type IdeaFilter = "active" | "archived";

function sortByCreatedAt(ideas: Idea[]) {
  return ideas.sort((a, b) => {
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
      callback(sortByCreatedAt(all.filter((i) => !i.archived)));
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
