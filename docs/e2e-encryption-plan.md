# End-to-End Encryption for Mindraft

## Context

Mindraft currently stores ideas in Firebase Firestore with Google-managed encryption at rest. This means Google (and the app developer via Admin SDK) can technically read all user content. The goal is true E2E encryption where **only the user** can decrypt their notes — the server, the developer, and Google all see only ciphertext.

Good news: Mindraft's architecture is unusually well-suited for E2E encryption because **all search and filtering already happens client-side**. This eliminates the biggest pain point most apps face (server-side search over encrypted data).

---

## Approaches Compared

### A. Passphrase-Derived Key (PBKDF2 -> AES-256-GCM)
User enters a passphrase -> PBKDF2 derives the encryption key directly.

- **Pro**: Simplest implementation, multi-device works naturally (same passphrase = same key)
- **Con**: Key quality depends on passphrase quality. Changing the passphrase requires re-encrypting every document.

### B. Device-Bound Key (random key in IndexedDB)
Random AES key generated per device, stored in IndexedDB. No passphrase.

- **Pro**: Zero friction on one device, key is full-entropy
- **Con**: Multi-device is a nightmare (need QR code / key-exchange protocol). Clearing browser data = permanent data loss. Not viable.

### C. Hybrid: Passphrase wraps a random Master Key (Recommended)
Random Master Key (MK) generated once. User's passphrase derives a Key Encryption Key (KEK) via PBKDF2. The MK is AES-KW wrapped with the KEK. Wrapped blob stored in Firestore.

- **Pro**: Full-entropy MK (not limited by passphrase quality). Passphrase change is cheap (re-wrap MK, no document re-encryption). Multi-device works via Firestore sync. Uses only built-in Web Crypto APIs.
- **Con**: Slightly more complex than A (one extra wrapping step). Passphrase loss = data loss (by design).

### D. Asymmetric (RSA/ECDH keypair)
Public key on server, private key encrypted with passphrase.

- **Pro**: Designed for multi-party scenarios
- **Con**: Overkill for single-user notes. RSA can only encrypt small payloads, so you still need symmetric encryption underneath -- making this a superset of C with no added benefit.

---

## Recommended: Approach C (Hybrid Passphrase + Wrapped Master Key)

### Key Hierarchy

```
User Passphrase
    | Argon2id (memory: 64 MB, iterations: 3, parallelism: 1, random 16-byte salt)
    v
Key Encryption Key (KEK) -- AES-256, never stored
    | AES-KW (wrap/unwrap)
    v
Master Key (MK) -- AES-256-GCM, random, stored WRAPPED in Firestore userPrefs
    | AES-256-GCM (unique 96-bit IV per write, AAD = {userId, docId, fieldName, version})
    v
Encrypted fields (title, body, tags)
```

**KDF choice — Argon2id over PBKDF2**: PBKDF2-SHA256 at 600k iterations is the OWASP 2023 minimum, but it is fully GPU-parallelizable. A high-end GPU can test roughly 1,500–2,000 passphrases/second at these iteration counts. Argon2id is memory-hard and makes GPU attacks 100–1000x more expensive for the same perceived latency on the user's device. Since the `wrappedMK` blob is stored in Firestore (and returned via the `/api/user/encryption-prefs` endpoint), an attacker who obtains it can mount an unlimited offline brute-force attack — so the KDF is the last line of defense against a weak passphrase.

Use `hash-wasm` for Argon2id (14KB compressed, used in production by 1Password and Bitwarden). Recommended parameters: `memory: 64 * 1024` (64 MB), `iterations: 3`, `parallelism: 1`, `hashLength: 32`, `salt: 16 random bytes`. These are the `hash-wasm` defaults and match OWASP 2023 Argon2id guidance. This adds one dependency but removes PBKDF2 from the plan entirely — `generateKey`/`deriveKey` in `SubtleCrypto` are still used for AES-256-GCM and AES-KW; only the KDF changes.

**WebCrypto for everything else**: AES-256-GCM, AES-KW, and random number generation remain native to the Web Crypto API (SubtleCrypto). No other external crypto libraries.

**AAD binding**: Every `encryptField`/`decryptField` call must bind `{ userId, docId, fieldName, schemaVersion }` as Additional Authenticated Data. Without this, AES-GCM authenticates the ciphertext but not its context -- an attacker with Firestore write access could swap a `title` blob into `body`, replay an old encrypted value, or copy a field from one document to another, and decryption would still succeed. AAD prevents all of these.

### What Gets Encrypted

| Field | Encrypted? | Why |
|-------|-----------|-----|
| `title` | **YES** | Core user content, most identifying |
| `body` | **YES** | Up to 50k chars of markdown |
| `tags` | **YES** | Reveals topics and interests |
| `status` | No | 3-value enum, low information, needed for potential server queries |
| `archived` | No | Boolean, needed for Firestore `where()` |
| `timestamps` | No | Operational metadata, needed for ordering |
| `sortOrder` | No | Numeric, operational |
| `refineNext` | No | Boolean, operational |
| `userId` | No | Needed for security rules and queries |

### Encrypted Document Schema in Firestore

```typescript
{
  id: string;
  userId: string;
  status: IdeaStatus;
  archived?: boolean;
  archivedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sortOrder?: number;
  refineNext?: boolean;

  // Encrypted envelope (replaces plaintext title/body/tags):
  encrypted: {
    v: 1,                    // schema version for future upgrades
    title: string,           // base64(IV + ciphertext + authTag)
    body: string,            // base64(IV + ciphertext + authTag)
    tags: string,            // base64(IV + ciphertext + authTag) -- JSON.stringify(tags) before encrypting
  }
}
```

### Key Management

**Setup**: User enables encryption in Settings -> enters passphrase -> client generates random MK (`extractable: true` for wrapping only) -> derives KEK via Argon2id with a random 16-byte salt -> AES-KW wraps the MK -> stores `{ wrappedMK, salt, kdfParams: { algorithm: "argon2id", memory, iterations, parallelism }, version, mkVersion: 1 }` in `userPrefs`.

**Session unlock**: On load, if encryption is enabled, show full-screen passphrase prompt -> derive KEK -> `unwrapKey` with `extractable: false` -> hold MK in memory as non-extractable CryptoKey.

**Multi-device**: Works automatically -- wrapped MK syncs via Firestore. Same passphrase on any device.

**Passphrase change**: Re-wrap MK with new KEK and increment `mkVersion` in `userPrefs`. Zero documents re-encrypted. The local stdio MCP server subscribes to `mkVersion` changes; on increment it discards its in-memory MK and re-prompts for the passphrase. This ensures that changing the passphrase (e.g., as a security response) immediately invalidates any running stdio server session.

**Recovery key**: During setup, optionally display the raw MK encoded as a human-readable word list (BIP-39 style, 24 words) for the user to write down offline. Base64 is not used -- it is typo-prone and unverifiable. The word list should include a checksum word so a transcription error is detectable before data loss occurs.

**Key loss**: No recovery without passphrase or recovery key. This is intentional and must be clearly communicated.

---

## Encryption is Opt-In (Dual Mode Forever)

E2E encryption is a **user choice**, not a system-wide requirement. The app permanently supports both modes:

- **Unencrypted users**: Everything works exactly as today. Full MCP tool support, plaintext in Firestore.
- **Encrypted users**: Content is E2E encrypted. MCP tools see ciphertext unless the user installs the local stdio MCP server (see Phase 6b).

**Why dual mode forever:**
- Not all users need E2E encryption -- some prioritize the convenience of full MCP/AI access
- Forcing encryption would break the MCP experience for users who don't want it
- Users should make an informed choice based on their threat model

**How the user chooses**: Settings page presents a clear "Enable End-to-End Encryption" section with a trade-offs summary (see below) before they commit.

### Trade-Offs Presented to the User

Before enabling encryption, the settings UI shows:

**What you gain:**
- Your note content (titles, body, tags) is encrypted with a key only you possess
- Not even the app developer or Google can read your notes
- If the database is ever breached, your content remains protected
- Offline cached data is also encrypted

**What you lose / changes:**
- You must enter an encryption passphrase each time you open the app (per session)
- If you forget your passphrase and lose your recovery key, your data is **permanently unrecoverable** -- no one can help
- MCP/AI tools (Claude, etc.) cannot read or create note content by default. Power users can install the local Mindraft MCP server, which decrypts on your machine and keeps the E2E guarantee intact
- There is minor performance overhead for encryption/decryption (negligible for typical note sizes)

---

## Impact on Existing Features

| Feature | Impact |
|---------|--------|
| **Real-time sync** | Transparent -- decrypt in `onSnapshot` callback before React state |
| **Client-side search/filter** | **No change** -- components receive decrypted `Idea` objects |
| **Offline / IndexedDB** | **Improved** -- cached data is ciphertext. Passphrase still needed on offline load |
| **Data export** | No change -- export runs client-side, decrypts in memory |
| **Account deletion** | No change -- delete encrypted docs same as plaintext |
| **MCP tools** | See MCP section below |

### MCP Tools with Encryption

**Default behavior (remote MCP server, no local install):** MCP tools return metadata only. `list_ideas` shows status/timestamps but `[encrypted]` for title. `get_idea` returns `[encrypted]` for title, body, tags. `create_idea` and `update_idea` return an error explaining encryption is active. `search_ideas` limited to metadata fields.

**Opt-in full access: local stdio MCP server.** The flow for encrypted users who want full AI access:

```
Agent (Claude Code)
    ↕ stdio
Local Mindraft MCP server (runs on user's machine -- holds MK)
    ↕ HTTPS + OAuth token
Mindraft server (passes ciphertext through, never decrypts)
    ↕ Firebase Admin SDK
Firestore (ciphertext only)
```

1. User installs the local Mindraft MCP server (`npm install -g @mindraft/mcp` or binary)
2. First run: `mindraft-mcp login` opens a browser → completes standard Mindraft OAuth flow → refresh token stored in system keychain. The local server never touches Firebase directly -- all data access goes through the Mindraft API.
3. On start: fetches `{ wrappedMK, salt, iterations, version }` from `GET /api/user/encryption-prefs` using the OAuth token → prompts for passphrase → derives KEK locally → unwraps MK → holds MK in process memory
4. For reads: fetches ciphertext from Mindraft API (ciphertext passthrough mode) → decrypts locally → returns plaintext to the agent
5. For writes: receives plaintext from agent → encrypts locally with MK → sends ciphertext to Mindraft API → server writes to Firestore

The Mindraft server never sees the passphrase, KEK, MK, or plaintext. It sees only OAuth tokens and ciphertext blobs -- the same data it stores in Firestore. Compromising an OAuth token gives an attacker ciphertext they cannot decrypt without the MK.

**Passphrase change propagation:** When the user changes their passphrase in the browser, the server re-wraps the MK with a new KEK and increments `mkVersion` in `userPrefs`. The local stdio server maintains a Firestore listener on `userPrefs.mkVersion`; when the value changes, it discards its in-memory MK immediately and re-prompts for the passphrase. This means passphrase change takes effect on the running server in real time, not just on next startup. A startup-time fallback also exists: AES-KW unwrap failure on launch triggers re-prompt (handles the case where the listener missed an update or the server was offline when the change occurred). The server does not fail silently in either case.

**Two MCP tiers:**

| Tier | How | E2E preserved? | Setup required |
|------|-----|----------------|----------------|
| Convenience | Remote MCP server | Yes (metadata only) | None |
| Power user | Local stdio MCP server | Yes (full access) | Install + login |

---

## Security Properties

**Protects against**: Firebase/Google employee reading data, developer reading via Admin SDK, Firestore database breach, network interception beyond TLS.

**Does NOT protect against**: XSS (fundamental web E2E limitation), compromised browser extensions, keyloggers, weak passphrases + offline brute force, metadata analysis (timing, counts, status), supply chain attacks on the JS bundle.

**Mitigations already in place**: React auto-escaping, strict CSP with nonces, HSTS preload. Note: `src/app/layout.tsx` uses `dangerouslySetInnerHTML` solely to inject the CSP nonce into a `<script>` tag -- this is intentional, reviewed, and not an XSS vector.

**Additional mitigations**: Enforce 12+ char passphrase with strength meter, Argon2id KDF (memory-hard, resistant to GPU brute force), version the encryption envelope for future upgrades.

---

## Implementation Phases

### Phase 1: Crypto Module
- Add `hash-wasm` dependency for Argon2id KDF
- Create `src/lib/crypto.ts` -- `generateMasterKey`, `deriveKEK`, `wrapKey`, `unwrapKey`, `encryptField`, `decryptField`, `encryptIdea`, `decryptIdea`
- Add `EncryptedIdea` type to `src/lib/types.ts`
- **Key extractability lifecycle** (must be explicit in implementation):
  - `generateMasterKey()` generates 32 random bytes and imports them as `extractable: true` solely to allow the `wrapKey` call that stores the MK in Firestore. After wrapping, the raw bytes should be zeroed.
  - All subsequent session use goes through `unwrapKey(..., extractable: false)`. The non-extractable session handle is what gets stored in `CryptoContext` and passed to `encryptField`/`decryptField`.
  - Unit test must assert: `sessionMK.extractable === false`.
- Unit tests for all crypto functions including: round-trip (encrypt → decrypt), wrong passphrase rejection, AAD mismatch rejection (swapped docId/fieldName must fail), Argon2id KDF determinism (same passphrase + salt → same KEK)

### Phase 2: React Integration
- Create `src/lib/crypto-context.tsx` -- CryptoProvider holding MK in memory, lock/unlock state
- Create `src/components/passphrase-prompt.tsx` -- full-screen unlock UI
- Create `src/components/encryption-setup.tsx` -- setup wizard (passphrase, recovery key)
- Add encryption settings section to `src/app/settings/page.tsx`

### Phase 3: Data Layer (Permanent Dual Mode)
- Modify `src/lib/firestore.ts` -- encrypt on write when MK is available, decrypt on read when `encrypted` field is present. Plaintext documents pass through unchanged.
- Update `firestore.rules` -- accept both schemas permanently (plaintext OR encrypted envelope)
- Clear MK from memory on sign-out in `src/lib/auth-context.tsx`

### Phase 4: Migration Tool

Data integrity is paramount. The migration never deletes plaintext until it has confirmed the encrypted copy can be successfully read back and decrypted. This means the migration is non-destructive until the final step, and can be safely interrupted and resumed at any point.

**Encrypt existing ideas** (shown in Settings after encryption is enabled):

The migration runs in three passes. Each pass operates over all plaintext ideas in batches of 450.

1. **Pass 1 — Write encrypted copies**: For each plaintext idea, encrypt `title`, `body`, `tags` and write the `encrypted` envelope to Firestore. The original `title`, `body`, `tags` fields are left untouched. After this pass, every idea has both plaintext fields and an `encrypted` envelope. The UI continues to function normally.

2. **Pass 2 — Read back and verify integrity**: For each idea that now has an `encrypted` envelope, fetch the document from Firestore, decrypt the `encrypted` envelope, and assert that the decrypted values match the original plaintext values. This confirms the encrypted copy in Firestore is readable and correct. Any document that fails verification is flagged and excluded from Pass 3 -- its plaintext fields remain as-is. If more than 1% of documents fail verification, abort the migration entirely and surface an error.

3. **Pass 3 — Remove plaintext fields**: For each idea that passed verification, update the document to remove `title`, `body`, and `tags` using `deleteField()`. This is the only destructive step. After this pass, Firestore contains only ciphertext for migrated documents.

A progress indicator in Settings shows the current pass and document count. If the user closes the app mid-migration, the next open resumes from the furthest completed pass (tracked by a `migrationState` field in `userPrefs`).

**"Decrypt all ideas"** option to disable encryption and revert to plaintext: uses the same three-pass approach in reverse (write plaintext, verify, remove `encrypted` envelope), ensuring no data loss if interrupted.

### Phase 5: MCP Adaptation (Metadata-Only Mode)
- Update `src/lib/server/firestore-admin.ts` -- detect `encrypted` field, return `[encrypted]` placeholders for title/body/tags
- Update `src/lib/server/mcp-tools.ts` -- tool descriptions note encryption limitations
- `create_idea`/`update_idea` return clear error when user has encryption enabled and no local stdio server

### Phase 6a: Server Ciphertext Passthrough API
Adds the two server-side primitives the local stdio server needs. No crypto on the server -- it passes blobs through and never touches keys.

- Add `GET /api/user/encryption-prefs` -- returns `{ wrappedMK, salt, kdfParams, version }` for the authenticated user. Owner-only: validate `uid` from OAuth token matches the prefs doc. Log every access (timestamp, IP, user-agent, token fingerprint) and alert on unusual patterns (e.g., the same user fetching from multiple IPs within a short window). **Rate limiting**: apply a conservative limit (e.g., 10 requests per user per hour). In practice a legitimate user hits this endpoint only on stdio server startup and after a passphrase change — normal usage is well under 10/day. The limit would only affect a user who repeatedly restarts the stdio server in quick succession (e.g., scripted restarts, crashing on startup), so if hits are seen near the limit it is worth investigating. Returning a clear `429` with a `Retry-After` header avoids silent failures in the stdio server.
- Add ciphertext passthrough mode to the Mindraft API -- when an OAuth token carries the `mindraft:mcp:ciphertext` scope, reads return raw `encrypted` envelopes instead of `[encrypted]` placeholders, and writes accept ciphertext envelopes directly. The server writes them to Firestore without inspecting content.
- The `mindraft:mcp:ciphertext` scope is only grantable from the `/connect` flow and is clearly labeled as the "local MCP server" scope so users know what they are authorizing.
- Add a **Connected apps** section to the Settings page listing all active `mindraft:mcp:ciphertext` grants (device name if captured during OAuth, last-seen timestamp, IP). Users can revoke individual grants from this UI. Revoking a grant invalidates the refresh token for that grant; the stdio server's next API call will receive a `401` and must re-authenticate via `mindraft-mcp login`. This gives users a clear response path if a laptop is lost or stolen.

### Phase 6b: Local stdio MCP Server
A separate distributable package (`@mindraft/mcp`) that runs on the user's machine.

- Implements the MCP protocol over stdio
- `mindraft-mcp login` -- opens browser OAuth flow, stores refresh token in system keychain (macOS Keychain / libsecret)
- On start: fetches wrappedMK from `GET /api/user/encryption-prefs` → prompts for passphrase → derives KEK → unwraps MK → holds as non-extractable CryptoKey in process memory
- All Mindraft API calls use the stored OAuth token (with `mindraft:mcp:ciphertext` scope); refreshes the token automatically
- Reads: fetch ciphertext → decrypt locally with AAD binding (`{ userId, docId, fieldName }`) → return plaintext to agent
- Writes: receive plaintext → encrypt locally → send ciphertext to Mindraft API
- **mkVersion listener**: maintains a Firestore listener on `userPrefs.mkVersion`; when it increments (passphrase changed in browser), discards the in-memory MK immediately and re-prompts for the passphrase. Takes effect on the running server in real time.
- **Startup stale-key detection**: AES-KW unwrap failure on startup also triggers re-prompt (handles missed listener updates or server being offline during a passphrase change)
- Versioned and released independently from the main app; breaking envelope schema changes require a coordinated version bump

## Verification
- Unit tests: crypto round-trip (encrypt -> decrypt), key wrapping, wrong passphrase rejection, AAD mismatch rejection (swapped docId/fieldName must fail), `sessionMK.extractable === false`, Argon2id KDF determinism
- Migration unit tests: after Pass 3, assert no `title`/`body`/`tags` fields exist at document top level; assert `encrypted` envelope is present and decryptable; assert interrupted migration resumes correctly from `migrationState`
- E2E tests: enable encryption, create idea, reload page, unlock, verify idea is readable. Note: `test:e2e` uses an in-memory Firestore mock -- the "verify Firestore contains ciphertext" check requires a separate integration test against a real Firebase emulator, not the mock.
- Manual: inspect Firestore console after migration to confirm no plaintext content in title/body/tags at document top level
- Run `npm run test`, `npm run test:e2e`, `npm run build`
