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
