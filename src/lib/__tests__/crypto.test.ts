import { describe, it, expect } from "vitest";
import {
  generateMasterKey,
  generateSalt,
  deriveKEK,
  wrapMasterKey,
  unwrapMasterKey,
  encryptField,
  decryptField,
  encryptIdea,
  decryptIdea,
} from "@/lib/crypto";
import type { Idea } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

// Helper to build a test Idea
function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "doc-1",
    userId: "user-1",
    title: "Hello World",
    body: "Some **markdown** body",
    tags: ["idea", "test"],
    status: "raw",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

// Shared test fixture: generate an MK + KEK once per suite
async function makeMKAndKEK(passphrase = "correct-passphrase-abc") {
  const salt = generateSalt();
  const kek = await deriveKEK(passphrase, salt);
  const { mk, raw } = await generateMasterKey();
  const wrappedMK = await wrapMasterKey(mk, kek);
  // Zero the raw bytes as required
  raw.fill(0);
  return { salt, wrappedMK, passphrase };
}

// ── generateMasterKey ────────────────────────────────────────────────────────

describe("generateMasterKey", () => {
  it("returns an extractable AES-GCM key", async () => {
    const { mk } = await generateMasterKey();
    expect(mk.extractable).toBe(true);
    expect(mk.algorithm.name).toBe("AES-GCM");
  });

  it("produces different keys on each call", async () => {
    const { raw: raw1 } = await generateMasterKey();
    const { raw: raw2 } = await generateMasterKey();
    expect(raw1).not.toEqual(raw2);
  });
});

// ── deriveKEK / Argon2id determinism ────────────────────────────────────────

describe("deriveKEK", () => {
  it("is deterministic: same passphrase + salt → same wrapped blob", async () => {
    const passphrase = "determinism-test-passphrase";
    const salt = generateSalt();

    // Generate a fresh MK and wrap it twice with the same passphrase+salt
    const { mk: mk1, raw: raw1 } = await generateMasterKey();
    const kek1 = await deriveKEK(passphrase, salt);
    const wrapped1 = await wrapMasterKey(mk1, kek1);
    raw1.fill(0);

    // Re-derive the KEK and unwrap — must succeed
    const kek2 = await deriveKEK(passphrase, salt);
    // If deterministic, unwrapping with kek2 must succeed on the blob from kek1
    const sessionMK = await unwrapMasterKey(wrapped1, kek2);
    expect(sessionMK).toBeDefined();
    expect(sessionMK.algorithm.name).toBe("AES-GCM");
  });

  it("returns an AES-KW key", async () => {
    const kek = await deriveKEK("my-passphrase", generateSalt());
    expect(kek.algorithm.name).toBe("AES-KW");
  });
});

// ── unwrapMasterKey extractability ───────────────────────────────────────────

describe("unwrapMasterKey", () => {
  it("returns a non-extractable CryptoKey (session handle)", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const sessionMK = await unwrapMasterKey(wrappedMK, kek);
    // Hard requirement from the security plan
    expect(sessionMK.extractable).toBe(false);
  });

  it("throws on wrong passphrase", async () => {
    const { salt, wrappedMK } = await makeMKAndKEK("correct-passphrase-abc");
    const wrongKEK = await deriveKEK("wrong-passphrase-xyz", salt);
    await expect(unwrapMasterKey(wrappedMK, wrongKEK)).rejects.toThrow();
  });
});

// ── encryptField / decryptField round-trip ───────────────────────────────────

describe("encryptField / decryptField", () => {
  const aad = { userId: "u1", docId: "d1", fieldName: "title", schemaVersion: 1 };

  it("round-trips plaintext correctly", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const plaintext = "Hello, encrypted world!";
    const ciphertext = await encryptField(mk, plaintext, aad);
    const decrypted = await decryptField(mk, ciphertext, aad);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const c1 = await encryptField(mk, "same text", aad);
    const c2 = await encryptField(mk, "same text", aad);
    expect(c1).not.toBe(c2);
  });

  it("throws when docId is swapped in AAD (prevents field replay attacks)", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const ciphertext = await encryptField(mk, "secret", aad);
    const wrongAAD = { ...aad, docId: "different-doc" };
    await expect(decryptField(mk, ciphertext, wrongAAD)).rejects.toThrow();
  });

  it("throws when fieldName is swapped in AAD (prevents field-swapping attacks)", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const ciphertext = await encryptField(mk, "secret", aad);
    const wrongAAD = { ...aad, fieldName: "body" };
    await expect(decryptField(mk, ciphertext, wrongAAD)).rejects.toThrow();
  });

  it("throws when userId is swapped in AAD", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const ciphertext = await encryptField(mk, "secret", aad);
    const wrongAAD = { ...aad, userId: "other-user" };
    await expect(decryptField(mk, ciphertext, wrongAAD)).rejects.toThrow();
  });

  it("throws on tampered ciphertext", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const ciphertext = await encryptField(mk, "secret", aad);
    // Flip a byte in the base64 blob
    const tampered = ciphertext.slice(0, -4) + "XXXX";
    await expect(decryptField(mk, tampered, aad)).rejects.toThrow();
  });
});

// ── encryptIdea / decryptIdea round-trip ─────────────────────────────────────

describe("encryptIdea / decryptIdea", () => {
  it("round-trips an Idea correctly", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const idea = makeIdea();
    const encrypted = await encryptIdea(mk, idea);
    const decrypted = await decryptIdea(mk, encrypted);

    expect(decrypted.title).toBe(idea.title);
    expect(decrypted.body).toBe(idea.body);
    expect(decrypted.tags).toEqual(idea.tags);
    expect(decrypted.id).toBe(idea.id);
    expect(decrypted.status).toBe(idea.status);
    expect(decrypted.userId).toBe(idea.userId);
  });

  it("removes plaintext title/body/tags from the encrypted output", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const idea = makeIdea();
    const encrypted = await encryptIdea(mk, idea);

    expect(encrypted).not.toHaveProperty("title");
    expect(encrypted).not.toHaveProperty("body");
    expect(encrypted).not.toHaveProperty("tags");
    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.encrypted?.v).toBe(1);
  });

  it("does not mutate the input idea", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const idea = makeIdea();
    const titleBefore = idea.title;
    await encryptIdea(mk, idea);
    expect(idea.title).toBe(titleBefore);
  });

  it("handles empty body and empty tags array", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const idea = makeIdea({ body: "", tags: [] });
    const encrypted = await encryptIdea(mk, idea);
    const decrypted = await decryptIdea(mk, encrypted);
    expect(decrypted.body).toBe("");
    expect(decrypted.tags).toEqual([]);
  });

  it("round-trips when Idea is built from Firestore-like data (migration pattern)", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    // Simulate what migrateToEncrypted does: build Idea from d.data() spread
    const firestoreData = {
      userId: "user-1",
      title: "Migration Test",
      body: "Body content",
      tags: ["tag1", "tag2"],
      status: "raw" as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      archived: false,
      sortOrder: 5,
    };

    const idea: Idea = {
      ...firestoreData,
      id: "doc-abc123",
      title: firestoreData.title ?? "",
      body: firestoreData.body ?? "",
      tags: firestoreData.tags ?? [],
    };

    const encrypted = await encryptIdea(mk, idea);

    // Simulate what subscribeToIdeas does: { id: d.id, ...d.data() }
    // After migration, d.data() has encrypted envelope but no title/body/tags
    const readDoc = {
      id: "doc-abc123",
      userId: "user-1",
      encrypted: encrypted.encrypted,
      status: "raw" as const,
      createdAt: firestoreData.createdAt,
      updatedAt: firestoreData.updatedAt,
      archived: false,
      sortOrder: 5,
    };

    const decrypted = await decryptIdea(mk, readDoc as Parameters<typeof decryptIdea>[1]);
    expect(decrypted.title).toBe("Migration Test");
    expect(decrypted.body).toBe("Body content");
    expect(decrypted.tags).toEqual(["tag1", "tag2"]);
  });
});

// ── Dual-mode invariant: plaintext pass-through ───────────────────────────────

describe("decryptIdea — plaintext pass-through (dual-mode invariant)", () => {
  it("returns plaintext doc unchanged when no encrypted field is present", async () => {
    const { salt, wrappedMK, passphrase } = await makeMKAndKEK();
    const kek = await deriveKEK(passphrase, salt);
    const mk = await unwrapMasterKey(wrappedMK, kek);

    const idea = makeIdea({ title: "Plaintext idea", tags: ["a", "b"] });
    // Simulate a Firestore doc with no `encrypted` field
    const plaintextDoc = { ...idea } as Parameters<typeof decryptIdea>[1];

    const result = await decryptIdea(mk, plaintextDoc);
    expect(result.title).toBe("Plaintext idea");
    expect(result.tags).toEqual(["a", "b"]);
    expect(result).toEqual(idea);
  });

  it("never throws for a plaintext doc even with a fresh random MK", async () => {
    const { mk } = await generateMasterKey();
    const idea = makeIdea();
    const plaintextDoc = { ...idea } as Parameters<typeof decryptIdea>[1];
    // Must not throw — plaintext docs are always safe to pass through
    await expect(decryptIdea(mk, plaintextDoc)).resolves.toEqual(idea);
  });
});
