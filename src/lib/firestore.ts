import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { Idea } from "./types";

const COLLECTION = "ideas";

export function subscribeToIdeas(
  userId: string,
  callback: (ideas: Idea[]) => void
) {
  const q = query(
    collection(getDb(), COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const ideas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Idea[];
    callback(ideas);
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

export async function deleteIdea(id: string) {
  return deleteDoc(doc(getDb(), COLLECTION, id));
}
