import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { generateMasterKey, encryptIdea, decryptIdea } from "@/lib/crypto";
import type { Idea, FirestoreIdeaDoc } from "@/lib/types";

// ── Firestore mocks ───────────────────────────────────────────────────────

const { setDocMock, updateDocMock, mockDocRef } = vi.hoisted(() => ({
  mockDocRef: { id: "test-doc-id" },
  setDocMock: vi.fn().mockResolvedValue(undefined),
  updateDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((...args: unknown[]) => {
    if (args.length === 1) return mockDocRef;
    return { id: args[2] ?? mockDocRef.id };
  }),
  addDoc: vi.fn().mockResolvedValue({ id: "mock-id" }),
  setDoc: setDocMock,
  updateDoc: updateDocMock,
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: () => "SERVER_TS",
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  deleteField: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getDb: vi.fn(),
}));

// Override the global mock from setup.ts — use the real implementations
// with our mocked firebase/firestore underneath
vi.mock("@/lib/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firestore")>();
  return actual;
});

// ── Helpers ────────────────────────────────────────────────────────────────

let mk: CryptoKey;

beforeAll(async () => {
  const result = await generateMasterKey();
  mk = result.mk;
});

function mockTimestamp() {
  return {
    seconds: 1000,
    nanoseconds: 0,
    toDate: () => new Date(1000000),
    toMillis: () => 1000000,
  };
}

function makePlaintextIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "test-doc-id",
    title: "My Idea",
    body: "Some body text",
    tags: ["tag1", "tag2"],
    status: "raw",
    createdAt: mockTimestamp() as Idea["createdAt"],
    updatedAt: mockTimestamp() as Idea["updatedAt"],
    userId: "user-1",
    ...overrides,
  };
}

// ── Import after mocks ────────────────────────────────────────────────────

const { addIdea, updateIdea } = await import("@/lib/firestore");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("addIdea with encryption", () => {
  beforeEach(() => {
    setDocMock.mockClear();
  });

  it("should write encrypted envelope when mk is provided", async () => {
    await addIdea("user-1", "Secret Title", "Secret Body", mk);

    expect(setDocMock).toHaveBeenCalledOnce();
    const payload = setDocMock.mock.calls[0][1];

    // Should have encrypted envelope
    expect(payload).toHaveProperty("encrypted");
    expect(payload.encrypted).toHaveProperty("v", 1);
    expect(payload.encrypted).toHaveProperty("title");
    expect(payload.encrypted).toHaveProperty("body");
    expect(payload.encrypted).toHaveProperty("tags");

    // Encrypted values should be base64 strings, not plaintext
    expect(typeof payload.encrypted.title).toBe("string");
    expect(payload.encrypted.title).not.toBe("Secret Title");
    expect(payload.encrypted.body).not.toBe("Secret Body");

    // Should NOT have plaintext content fields
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("body");
    expect(payload).not.toHaveProperty("tags");

    // Should still have metadata
    expect(payload).toHaveProperty("status", "raw");
    expect(payload).toHaveProperty("userId", "user-1");
    expect(payload).toHaveProperty("createdAt", "SERVER_TS");
    expect(payload).toHaveProperty("updatedAt", "SERVER_TS");
  });

  it("should write plaintext when mk is null", async () => {
    await addIdea("user-1", "Plain Title", "Plain Body", null);

    expect(setDocMock).toHaveBeenCalledOnce();
    const payload = setDocMock.mock.calls[0][1];

    expect(payload).toHaveProperty("title", "Plain Title");
    expect(payload).toHaveProperty("body", "Plain Body");
    expect(payload).toHaveProperty("tags", []);
    expect(payload).not.toHaveProperty("encrypted");
  });

  it("should write plaintext when mk is omitted", async () => {
    await addIdea("user-1", "Default Title");

    const payload = setDocMock.mock.calls[0][1];
    expect(payload).toHaveProperty("title", "Default Title");
    expect(payload).not.toHaveProperty("encrypted");
  });
});

describe("updateIdea with encryption", () => {
  beforeEach(() => {
    updateDocMock.mockClear();
  });

  it("should encrypt content fields when mk is provided", async () => {
    const currentIdea = makePlaintextIdea();

    await updateIdea(
      "test-doc-id",
      { title: "Updated Title" },
      { mk, currentIdea }
    );

    expect(updateDocMock).toHaveBeenCalledOnce();
    const payload = updateDocMock.mock.calls[0][1];

    // Should have encrypted envelope
    expect(payload).toHaveProperty("encrypted");
    expect(payload.encrypted.v).toBe(1);

    // Should NOT have plaintext content in the update
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("body");
    expect(payload).not.toHaveProperty("tags");
  });

  it("should pass through non-content updates without encryption", async () => {
    const currentIdea = makePlaintextIdea();

    await updateIdea(
      "test-doc-id",
      { status: "in-progress" },
      { mk, currentIdea }
    );

    expect(updateDocMock).toHaveBeenCalledOnce();
    const payload = updateDocMock.mock.calls[0][1];

    // No content fields changed, so no encryption needed
    expect(payload).not.toHaveProperty("encrypted");
    expect(payload).toHaveProperty("status", "in-progress");
    expect(payload).toHaveProperty("updatedAt", "SERVER_TS");
  });

  it("should include non-content fields alongside encrypted envelope", async () => {
    const currentIdea = makePlaintextIdea();

    await updateIdea(
      "test-doc-id",
      { title: "New Title", status: "developed" },
      { mk, currentIdea }
    );

    const payload = updateDocMock.mock.calls[0][1];

    // Should have both encrypted envelope and non-content field
    expect(payload).toHaveProperty("encrypted");
    expect(payload).toHaveProperty("status", "developed");
    expect(payload).not.toHaveProperty("title");
  });

  it("should write plaintext when mk is null", async () => {
    await updateIdea("test-doc-id", { title: "Plain Update" });

    expect(updateDocMock).toHaveBeenCalledOnce();
    const payload = updateDocMock.mock.calls[0][1];
    expect(payload).toHaveProperty("title", "Plain Update");
    expect(payload).not.toHaveProperty("encrypted");
  });
});

describe("decryptDocs (dual-mode)", () => {
  it("should pass plaintext docs through unchanged", async () => {
    const plainDoc: FirestoreIdeaDoc = {
      id: "doc-1",
      title: "Plain Title",
      body: "Plain Body",
      tags: ["tag1"],
      status: "raw",
      userId: "user-1",
      createdAt: mockTimestamp() as Idea["createdAt"],
      updatedAt: mockTimestamp() as Idea["updatedAt"],
    };

    const result = await decryptIdea(mk, plainDoc);

    expect(result.title).toBe("Plain Title");
    expect(result.body).toBe("Plain Body");
    expect(result.tags).toEqual(["tag1"]);
  });

  it("should decrypt encrypted docs with mk", async () => {
    const idea = makePlaintextIdea();
    const encDoc = await encryptIdea(mk, idea);

    const result = await decryptIdea(mk, encDoc);

    expect(result.title).toBe("My Idea");
    expect(result.body).toBe("Some body text");
    expect(result.tags).toEqual(["tag1", "tag2"]);
  });

  it("should handle empty body and tags", async () => {
    const idea = makePlaintextIdea({ body: "", tags: [] });
    const encDoc = await encryptIdea(mk, idea);

    const result = await decryptIdea(mk, encDoc);

    expect(result.title).toBe("My Idea");
    expect(result.body).toBe("");
    expect(result.tags).toEqual([]);
  });

  it("should round-trip through encrypt and decrypt", async () => {
    const idea = makePlaintextIdea({
      title: "Round Trip Title",
      body: "# Markdown\n\nWith **bold** text",
      tags: ["important", "crypto", "test"],
    });

    const encrypted = await encryptIdea(mk, idea);

    // Verify encrypted doc has no plaintext
    expect(encrypted.title).toBeUndefined();
    expect(encrypted.body).toBeUndefined();
    expect(encrypted.tags).toBeUndefined();
    expect(encrypted.encrypted).toBeDefined();

    const decrypted = await decryptIdea(mk, encrypted);

    expect(decrypted.title).toBe("Round Trip Title");
    expect(decrypted.body).toBe("# Markdown\n\nWith **bold** text");
    expect(decrypted.tags).toEqual(["important", "crypto", "test"]);
    expect(decrypted.id).toBe(idea.id);
    expect(decrypted.userId).toBe(idea.userId);
  });
});
