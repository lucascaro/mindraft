import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the data passed to setDoc
const setDocMock = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { id: "mock-id" };

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: (...args: unknown[]) => {
    // When called with just a collection ref (pre-generate ID), return mock ref
    if (args.length === 1) return mockDocRef;
    return mockDocRef;
  },
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: () => "SERVER_TS",
}));

vi.mock("@/lib/firebase", () => ({
  getDb: vi.fn(),
}));

// Mock crypto module — not used in plaintext tests but imported by firestore.ts
vi.mock("@/lib/crypto", () => ({
  encryptIdea: vi.fn(),
  decryptIdea: vi.fn(),
}));

// Import after mocks are set up
const { addIdea } = await import("@/lib/firestore");

describe("addIdea", () => {
  beforeEach(() => {
    setDocMock.mockClear();
  });

  it("should not include 'archived' or 'sortOrder' in the created document", async () => {
    await addIdea("user-1", "My Idea", "Some body");

    expect(setDocMock).toHaveBeenCalledOnce();
    const payload = setDocMock.mock.calls[0][1];

    expect(payload).not.toHaveProperty("archived");
    expect(payload).not.toHaveProperty("archivedAt");
    // sortOrder must be absent so new ideas land in the "new/unordered" sort tier
    expect(payload).not.toHaveProperty("sortOrder");
  });

  it("should include all required fields for firestore rules validCreate()", async () => {
    await addIdea("user-1", "Title", "Body");

    const payload = setDocMock.mock.calls[0][1];

    expect(payload).toMatchObject({
      userId: "user-1",
      title: "Title",
      body: "Body",
      tags: [],
      status: "raw",
      createdAt: "SERVER_TS",
      updatedAt: "SERVER_TS",
    });

    // Only allowed keys per firestore.rules validCreate() — plaintext schema
    const allowedKeys = [
      "userId",
      "title",
      "body",
      "tags",
      "status",
      "createdAt",
      "updatedAt",
      "sortOrder",
      "refineNext",
    ];
    for (const key of Object.keys(payload)) {
      expect(allowedKeys).toContain(key);
    }
  });
});
