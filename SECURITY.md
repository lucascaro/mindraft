# Security

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private disclosure process:

1. Go to the [Security Advisories](../../security/advisories) tab of this repository.
2. Click **Report a vulnerability**.
3. Fill in the details: affected area, steps to reproduce, potential impact.

We will acknowledge your report within **2 business days** and aim to release a fix within **14 days** for critical issues. We will keep you informed of progress and credit you in the advisory unless you prefer to remain anonymous.

## Security Architecture

### Authentication

Mindraft uses **Firebase Authentication** with Google Sign-In. Server-side operations verify Firebase ID tokens using the Firebase Admin SDK, which is isolated to server-only modules and never bundled into client code.

For programmatic access (MCP clients), Mindraft implements an **OAuth 2.0 authorization server** with:

- **PKCE (S256)** for authorization code exchange, preventing code interception attacks
- **Refresh token rotation** with reuse detection: presenting an already-rotated token revokes the entire token family
- **Single-use authorization codes** that are burned on first access, even if verification fails
- **Short-lived access tokens** (1-hour JWT) with long-lived refresh tokens (30-day absolute cap, never extended)
- **Hashed token storage**: only SHA-256 hashes of refresh tokens are persisted; raw tokens are never stored
- **Timing-safe comparison** for all security-critical string checks

### End-to-End Encryption

When enabled, idea content is encrypted client-side before it leaves the browser. The server only stores ciphertext. Mindraft cannot read your encrypted data.

**Key hierarchy:**

```
Passphrase → Argon2id (64 MB, 3 iterations) → KEK (AES-KW) → wraps Master Key
Master Key (AES-256-GCM) → encrypts individual idea fields
```

- **Key derivation:** Argon2id with 64 MB memory cost, making brute-force attacks GPU-resistant
- **Encryption:** AES-256-GCM with a fresh 12-byte IV per encryption operation
- **Authenticated data:** Each ciphertext is bound to its user, document, field name, and schema version using Additional Authenticated Data (AAD), preventing field-swapping attacks
- **Session keys:** The master key is held as a non-extractable `CryptoKey` during the session; JavaScript cannot read the raw key material
- **No plaintext key storage:** Only the AES-KW-wrapped master key blob is persisted in Firestore

### Data Isolation

Firestore security rules enforce per-user data isolation:

- Every read and write operation requires the authenticated user's UID to match the document owner
- Input validation is enforced at the database level (title length, body size, tag count)
- Immutable fields (`userId`, `createdAt`) cannot be modified after creation
- A deny-all catch-all rule blocks access to any undefined collections

### Transport Security

- **HSTS** with a 2-year max-age, includeSubDomains, and preload
- **Content Security Policy** with per-request nonces for inline scripts (`strict-dynamic`)
- **X-Frame-Options: DENY** to prevent clickjacking
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** disabling camera, microphone, and geolocation

### Dependency Management

- Automated dependency scanning via Dependabot (weekly)
- Lock file (`package-lock.json`) tracked in version control for reproducible builds
- Server-only packages (`firebase-admin`) explicitly excluded from client bundles

## Out of Scope

The following are not considered vulnerabilities for this project:

- Self-XSS (requires the attacker to run code in their own browser)
- Social engineering attacks
- Volumetric denial-of-service
- Security issues in third-party infrastructure (Firebase, Google Sign-In, Vercel) -- report those directly to the respective vendors
- Findings from automated scanners with no demonstrated impact
