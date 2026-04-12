/**
 * E2E Encryption crypto module.
 *
 * Key hierarchy:
 *   Passphrase → Argon2id → KEK (AES-KW) → wraps/unwraps MK
 *   MK (AES-256-GCM) → encrypts/decrypts individual idea fields
 *
 * All crypto is Web Crypto (SubtleCrypto) except the Argon2id KDF which uses
 * hash-wasm. No keys are ever stored in plaintext; only the AES-KW-wrapped
 * master key blob is persisted (in Firestore userPrefs).
 */

import { argon2id } from "hash-wasm";
import type { EncryptedEnvelope, FirestoreIdeaDoc, Idea } from "./types";

// ── Constants ────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

const ARGON2_PARAMS = {
  memorySize: 64 * 1024, // 64 MB (hash-wasm param name)
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  // Allocate via ArrayBuffer explicitly so SubtleCrypto's BufferSource check passes
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeAAD(aad: FieldAAD): Uint8Array<ArrayBuffer> {
  const str = JSON.stringify({
    userId: aad.userId,
    docId: aad.docId,
    fieldName: aad.fieldName,
    schemaVersion: aad.schemaVersion,
  });
  // Copy TextEncoder output to a plain ArrayBuffer so SubtleCrypto accepts it
  const raw = new TextEncoder().encode(str);
  const buf = new Uint8Array(new ArrayBuffer(raw.length));
  buf.set(raw);
  return buf;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type FieldAAD = {
  userId: string;
  docId: string;
  fieldName: string;
  schemaVersion: number;
};

// ── Master Key generation ────────────────────────────────────────────────────

/**
 * Generates a new random Master Key.
 * Returns `{ mk, raw }` where `mk` is `extractable: true` (required for wrapKey)
 * and `raw` is the underlying bytes.
 *
 * IMPORTANT: The caller MUST zero `raw` after calling `wrapMasterKey`.
 * The non-extractable session handle comes from `unwrapMasterKey`.
 */
export async function generateMasterKey(): Promise<{
  mk: CryptoKey;
  raw: Uint8Array;
}> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const mk = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true, // extractable: true — needed for wrapKey only
    ["encrypt", "decrypt"]
  );
  return { mk, raw };
}

// ── KEK derivation ───────────────────────────────────────────────────────────

/**
 * Derives a Key Encryption Key (KEK) from a passphrase using Argon2id.
 * The KEK is an AES-KW key used only for wrapping/unwrapping the master key.
 * The KEK is NEVER stored.
 *
 * @param passphrase - User's passphrase
 * @param salt - 16-byte random salt (base64 encoded)
 */
export async function deriveKEK(
  passphrase: string,
  salt: string
): Promise<CryptoKey> {
  const saltBytes = fromBase64(salt);

  const keyBytesRaw = await argon2id({
    password: passphrase,
    salt: saltBytes,
    ...ARGON2_PARAMS,
    outputType: "binary",
  });
  // Copy to a plain ArrayBuffer — hash-wasm returns Uint8Array<ArrayBufferLike>
  // but SubtleCrypto.importKey requires ArrayBufferView<ArrayBuffer>.
  const keyBytes = new Uint8Array(keyBytesRaw);

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-KW" },
    false, // KEK is never extractable
    ["wrapKey", "unwrapKey"]
  );
}

/** Generates a fresh 16-byte salt for Argon2id. Returns base64-encoded bytes. */
export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

// ── Key wrapping / unwrapping ────────────────────────────────────────────────

/**
 * Wraps the (extractable) Master Key with the KEK using AES-KW.
 * Returns a base64-encoded wrapped key blob for Firestore storage.
 */
export async function wrapMasterKey(
  mk: CryptoKey,
  kek: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", mk, kek, "AES-KW");
  return toBase64(wrapped);
}

/**
 * Unwraps the Master Key from the stored blob.
 * Returns a non-extractable CryptoKey — this is the session handle.
 * Throws on wrong passphrase (bad KEK) or corrupted blob.
 */
export async function unwrapMasterKey(
  wrappedMKBase64: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  const wrappedMK = fromBase64(wrappedMKBase64);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedMK,
    kek,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    false, // extractable: false — session handle must not be extractable
    ["encrypt", "decrypt"]
  );
}

// ── Field encryption / decryption ────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Each call generates a fresh 96-bit IV. AAD binds the ciphertext to its
 * document+field context, preventing field-swapping attacks.
 *
 * Returns base64(iv[12] + ciphertext + authTag[16]).
 */
export async function encryptField(
  mk: CryptoKey,
  plaintext: string,
  aad: FieldAAD
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawEncoded = new TextEncoder().encode(plaintext);
  const encoded = new Uint8Array(new ArrayBuffer(rawEncoded.length));
  encoded.set(rawEncoded);

  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encodeAAD(aad) },
    mk,
    encoded
  );

  // Pack as iv (12 bytes) + ciphertext+authTag
  const result = new Uint8Array(12 + ciphertextWithTag.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertextWithTag), 12);
  return toBase64(result);
}

/**
 * Decrypts a field produced by `encryptField`.
 * Throws on wrong key, tampered data, or AAD mismatch.
 */
export async function decryptField(
  mk: CryptoKey,
  ciphertextBase64: string,
  aad: FieldAAD
): Promise<string> {
  const bytes = fromBase64(ciphertextBase64);
  const iv = bytes.slice(0, 12);
  const ciphertextWithTag = bytes.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encodeAAD(aad) },
    mk,
    ciphertextWithTag
  );

  return new TextDecoder().decode(plaintext);
}

// ── Idea-level encrypt / decrypt ─────────────────────────────────────────────

/**
 * Encrypts an idea's content fields (title, body, tags) into an encrypted envelope.
 * Returns a new object — never mutates the input.
 * The returned object has the encrypted envelope and no plaintext title/body/tags.
 */
export async function encryptIdea(
  mk: CryptoKey,
  idea: Idea
): Promise<FirestoreIdeaDoc> {
  const baseAAD = {
    userId: idea.userId,
    docId: idea.id,
    schemaVersion: SCHEMA_VERSION,
  };

  const [encTitle, encBody, encTags] = await Promise.all([
    encryptField(mk, idea.title, { ...baseAAD, fieldName: "title" }),
    encryptField(mk, idea.body, { ...baseAAD, fieldName: "body" }),
    encryptField(mk, JSON.stringify(idea.tags), {
      ...baseAAD,
      fieldName: "tags",
    }),
  ]);

  const {
    title: _title,
    body: _body,
    tags: _tags,
    ...rest
  } = idea;

  return {
    ...rest,
    encrypted: {
      v: 1,
      title: encTitle,
      body: encBody,
      tags: encTags,
    },
  };
}

/**
 * Decrypts an idea document from Firestore.
 *
 * If the document has no `encrypted` field (plaintext doc), returns it
 * unchanged — pure pass-through. This is the dual-mode invariant:
 * plaintext users are never affected.
 *
 * Throws on decryption failure (wrong key, tampered data, AAD mismatch).
 */
export async function decryptIdea(
  mk: CryptoKey,
  doc: FirestoreIdeaDoc
): Promise<Idea> {
  // Dual-mode invariant: plaintext docs pass through unchanged
  if (!doc.encrypted) {
    return doc as unknown as Idea;
  }

  const baseAAD = {
    userId: doc.userId,
    docId: doc.id,
    schemaVersion: SCHEMA_VERSION,
  };

  const [title, body, tagsJson] = await Promise.all([
    decryptField(mk, doc.encrypted.title, { ...baseAAD, fieldName: "title" }),
    decryptField(mk, doc.encrypted.body, { ...baseAAD, fieldName: "body" }),
    decryptField(mk, doc.encrypted.tags, { ...baseAAD, fieldName: "tags" }),
  ]);

  const tags: string[] = JSON.parse(tagsJson);

  const { encrypted: _encrypted, ...rest } = doc;

  return {
    ...rest,
    title,
    body,
    tags,
  } as Idea;
}
