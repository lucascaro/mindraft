import { Timestamp } from "firebase/firestore";

export type IdeaStatus = "raw" | "in-progress" | "developed";

export const IDEA_STATUSES: { value: IdeaStatus; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "in-progress", label: "In Progress" },
  { value: "developed", label: "Developed" },
];

export type Idea = {
  id: string;
  title: string;
  body: string; // markdown
  tags: string[];
  status: IdeaStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  archived?: boolean;
  archivedAt?: Timestamp;
  sortOrder?: number;
  refineNext?: boolean;
};

/** Encrypted envelope stored in Firestore when E2E encryption is enabled. */
export type EncryptedEnvelope = {
  v: 1;
  title: string; // base64(iv + ciphertext + authTag)
  body: string;
  tags: string; // encrypts JSON.stringify(tags[])
};

/**
 * Shape of an idea document as it lives in Firestore.
 * May be plaintext (title/body/tags present) OR encrypted (encrypted envelope present).
 * The app-internal `Idea` type always has title/body/tags decrypted.
 */
export type FirestoreIdeaDoc = Omit<Idea, "title" | "body" | "tags"> & {
  title?: string;
  body?: string;
  tags?: string[];
  encrypted?: EncryptedEnvelope;
};

/** Encryption prefs stored in userPrefs/{userId}.encryption */
export type EncryptionPrefs = {
  enabled: boolean;
  wrappedMK: string; // base64 AES-KW blob
  salt: string; // base64 16-byte Argon2id salt
  kdfParams: {
    algorithm: "argon2id";
    memory: number; // 65536
    iterations: number; // 3
    parallelism: number; // 1
  };
  version: number; // schema version, starts at 1
  mkVersion: number; // increments on passphrase change (stdio server listener)
};
