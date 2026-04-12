import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { generateMasterKey, encryptIdea } from "@/lib/crypto";
import type { Idea } from "@/lib/types";

// ── Firestore mocks ───────────────────────────────────────────────────────

const DELETE_FIELD_SENTINEL = Symbol("deleteField");

const { setDocMock, batchMock, getDocsMock } = vi.hoisted(() => {
  const batchUpdateMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);
  return {
    setDocMock: vi.fn().mockResolvedValue(undefined),
    getDocsMock: vi.fn(),
    batchMock: {
      update: batchUpdateMock,
      commit: batchCommitMock,
    },
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((...args: unknown[]) => {
    if (args.length >= 3) return { id: args[2] };
    return { id: "prefs-doc" };
  }),
  setDoc: setDocMock,
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: () => "SERVER_TS",
  query: vi.fn(),
  where: vi.fn(),
  getDocs: getDocsMock,
  deleteField: () => DELETE_FIELD_SENTINEL,
  writeBatch: () => batchMock,
}));

vi.mock("@/lib/firebase", () => ({
  getDb: vi.fn(),
}));

// Use real implementations
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

function makePlaintextDoc(id: string, title: string): {
  id: string;
  ref: { id: string };
  data: () => Record<string, unknown>;
} {
  return {
    id,
    ref: { id },
    data: () => ({
      userId: "user-1",
      title,
      body: `Body for ${title}`,
      tags: ["tag1"],
      status: "raw",
      createdAt: mockTimestamp(),
      updatedAt: mockTimestamp(),
    }),
  };
}

async function makeEncryptedDoc(id: string, title: string) {
  const idea: Idea = {
    id,
    title,
    body: `Body for ${title}`,
    tags: ["tag1"],
    status: "raw",
    userId: "user-1",
    createdAt: mockTimestamp() as Idea["createdAt"],
    updatedAt: mockTimestamp() as Idea["updatedAt"],
  };
  const encrypted = await encryptIdea(mk, idea);
  return {
    id,
    ref: { id },
    data: () => ({
      userId: "user-1",
      status: "raw",
      createdAt: mockTimestamp(),
      updatedAt: mockTimestamp(),
      encrypted: encrypted.encrypted,
    }),
  };
}

function mockSnapshotWith(docs: ReturnType<typeof makePlaintextDoc>[]) {
  getDocsMock.mockResolvedValue({
    docs,
    empty: docs.length === 0,
  });
}

// ── Import after mocks ────────────────────────────────────────────────────

const { countEncryptionStatus, migrateToEncrypted, migrateToPlaintext } =
  await import("@/lib/firestore");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("countEncryptionStatus", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    batchMock.update.mockClear();
    batchMock.commit.mockClear();
    setDocMock.mockClear();
  });

  it("should count plaintext and encrypted docs", async () => {
    const encDoc = await makeEncryptedDoc("enc-1", "Encrypted");
    mockSnapshotWith([
      makePlaintextDoc("plain-1", "Plain One"),
      makePlaintextDoc("plain-2", "Plain Two"),
      encDoc,
    ]);

    const result = await countEncryptionStatus("user-1");

    expect(result.plaintext).toBe(2);
    expect(result.encrypted).toBe(1);
  });

  it("should return 0/0 for empty collection", async () => {
    mockSnapshotWith([]);

    const result = await countEncryptionStatus("user-1");

    expect(result.plaintext).toBe(0);
    expect(result.encrypted).toBe(0);
  });
});

describe("migrateToEncrypted", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    batchMock.update.mockClear();
    batchMock.commit.mockClear();
    setDocMock.mockClear();
  });

  it("should encrypt plaintext docs and skip encrypted ones", async () => {
    const encDoc = await makeEncryptedDoc("enc-1", "Already Encrypted");
    mockSnapshotWith([
      makePlaintextDoc("plain-1", "Plain One"),
      makePlaintextDoc("plain-2", "Plain Two"),
      encDoc,
    ]);

    const result = await migrateToEncrypted("user-1", mk);

    expect(result.total).toBe(2);
    expect(result.processed).toBe(2);
    expect(result.skipped).toBe(1);

    // Should have called batch.update for each plaintext doc
    expect(batchMock.update).toHaveBeenCalledTimes(2);
    expect(batchMock.commit).toHaveBeenCalledOnce();

    // Verify the update payloads have encrypted envelope and deleteField for plaintext
    for (const call of batchMock.update.mock.calls) {
      const payload = call[1] as Record<string, unknown>;
      expect(payload).toHaveProperty("encrypted");
      expect((payload.encrypted as Record<string, unknown>).v).toBe(1);
      expect(payload.title).toBe(DELETE_FIELD_SENTINEL);
      expect(payload.body).toBe(DELETE_FIELD_SENTINEL);
      expect(payload.tags).toBe(DELETE_FIELD_SENTINEL);
      expect(payload.updatedAt).toBe("SERVER_TS");
    }
  });

  it("should handle empty collection", async () => {
    mockSnapshotWith([]);

    const result = await migrateToEncrypted("user-1", mk);

    expect(result.total).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(batchMock.update).not.toHaveBeenCalled();
    expect(batchMock.commit).not.toHaveBeenCalled();
  });

  it("should fire progress callback", async () => {
    mockSnapshotWith([
      makePlaintextDoc("plain-1", "One"),
      makePlaintextDoc("plain-2", "Two"),
    ]);

    const onProgress = vi.fn();
    await migrateToEncrypted("user-1", mk, onProgress);

    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it("should persist migration state in userPrefs", async () => {
    mockSnapshotWith([makePlaintextDoc("plain-1", "One")]);

    await migrateToEncrypted("user-1", mk);

    // setDoc should be called to update migration state
    expect(setDocMock).toHaveBeenCalled();
    const [, payload, opts] = setDocMock.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(payload.encryption.migrationState.direction).toBe("encrypt");
    expect(payload.encryption.migrationState.total).toBe(1);
    expect(payload.encryption.migrationState.processed).toBe(1);
    expect(payload.encryption.migrationState.completedAt).toBeDefined();
  });
});

describe("migrateToPlaintext", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    batchMock.update.mockClear();
    batchMock.commit.mockClear();
    setDocMock.mockClear();
  });

  it("should decrypt encrypted docs and skip plaintext ones", async () => {
    const encDoc = await makeEncryptedDoc("enc-1", "Secret Note");
    mockSnapshotWith([makePlaintextDoc("plain-1", "Plain One"), encDoc]);

    const result = await migrateToPlaintext("user-1", mk);

    expect(result.total).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);

    expect(batchMock.update).toHaveBeenCalledOnce();
    expect(batchMock.commit).toHaveBeenCalledOnce();

    // Verify the update has plaintext fields and deleteField for encrypted
    const payload = batchMock.update.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(payload.title).toBe("Secret Note");
    expect(payload.body).toBe("Body for Secret Note");
    expect(payload.tags).toEqual(["tag1"]);
    expect(payload.encrypted).toBe(DELETE_FIELD_SENTINEL);
    expect(payload.updatedAt).toBe("SERVER_TS");
  });

  it("should handle empty collection", async () => {
    mockSnapshotWith([]);

    const result = await migrateToPlaintext("user-1", mk);

    expect(result.total).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("should fire progress callback", async () => {
    const encDoc = await makeEncryptedDoc("enc-1", "Secret");
    mockSnapshotWith([encDoc]);

    const onProgress = vi.fn();
    await migrateToPlaintext("user-1", mk, onProgress);

    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it("should persist migration state in userPrefs", async () => {
    const encDoc = await makeEncryptedDoc("enc-1", "Secret");
    mockSnapshotWith([encDoc]);

    await migrateToPlaintext("user-1", mk);

    expect(setDocMock).toHaveBeenCalled();
    const [, payload] = setDocMock.mock.calls[0];
    expect(payload.encryption.migrationState.direction).toBe("decrypt");
    expect(payload.encryption.migrationState.total).toBe(1);
    expect(payload.encryption.migrationState.processed).toBe(1);
  });
});
