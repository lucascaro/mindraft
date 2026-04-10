# Mindraft MCP Server

Mindraft exposes an MCP (Model Context Protocol) server so AI agents can read and manage your ideas directly — no copy-paste required.

The MCP server is built into the Mindraft app. Users authenticate with their own Google account, exactly as they do to use Mindraft normally. No credentials are ever shared with the agent.

**Endpoint:** `{APP_URL}/api/mcp`

---

## Prerequisites

- A deployed Mindraft instance (or `npm run dev` locally)
- A Firebase service account with Firestore access (one-time setup by whoever deploys the app)

---

## Server setup (one-time, by the app operator)

### 1. Create a service account

1. Firebase Console → **Project Settings** → **Service accounts** tab
2. Click **Generate new private key** → download the JSON file
3. In IAM settings, assign this account only the **Cloud Datastore User** role (read/write Firestore, nothing else)

> Do not commit the service account JSON. Store the values as environment variables only.

### 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in the new server-side vars:

```bash
# From the service account JSON:
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"

# Your app's public URL (no trailing slash):
NEXT_PUBLIC_APP_URL=https://app.mindraft.app

# A random secret for signing access tokens:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MCP_JWT_SECRET=your-random-secret-here
```

**Important:** The `FIREBASE_PRIVATE_KEY` value must have literal `\n` sequences (not actual newlines) when stored in a `.env` file or environment variable. The server handles the conversion automatically.

### 3. Restart the server

```bash
npm run dev    # or npm run build && npm start for production
```

Verify the OAuth metadata is accessible:

```bash
curl https://app.mindraft.app/.well-known/oauth-authorization-server
```

---

## User setup (for each user connecting their agent)

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mindraft": {
      "url": "https://app.mindraft.app/api/mcp"
    }
  }
}
```

Replace the URL with your actual app URL. Restart Claude Desktop — it will prompt you to sign in with Google on first use.

### Cursor / other MCP clients

Add the URL `https://app.mindraft.app/api/mcp` as an MCP server in your client's settings. The client will open a browser window for Google sign-in automatically.

### Local development

```json
{
  "mcpServers": {
    "mindraft": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

---

## Available tools

| Tool | Description |
|------|-------------|
| `list_ideas` | List active ideas (optional filters: `status`, `tag`, `search`, `limit`) |
| `get_idea` | Get a single idea by ID including full body |
| `create_idea` | Create a new idea (`title` required; `body`, `tags` optional) |
| `update_idea` | Update title, body, tags, and/or status |
| `archive_idea` | Soft-delete an idea (recoverable) |
| `restore_idea` | Restore an archived idea |
| `delete_idea` | Permanently delete — requires `confirm: true` |
| `list_archived_ideas` | List archived ideas |
| `search_ideas` | Keyword search across title and body |

Ideas have three statuses: `raw` (default), `in-progress`, `developed`.

---

## Security model

- **OAuth 2.1 with PKCE** — agents connect via a standard authorization code flow with S256 challenge. No passwords or API keys are ever stored by the agent.
- **Google sign-in** — authentication is handled entirely by Firebase / Google. Mindraft never sees your password.
- **Per-user isolation** — access tokens are bound to a specific Firebase UID. An agent can only access ideas belonging to the authenticated user. The `userId` is never accepted as a tool parameter.
- **Short-lived access tokens** — access tokens expire after 1 hour. MCP clients use a refresh token to silently mint a new one.
- **Rotating refresh tokens** — refresh tokens have a 30-day absolute lifetime and are rotated on every use. Reusing an already-rotated refresh token revokes the entire family, catching the scenario where a token is stolen and used in parallel with the legitimate client.
- **Token revocation** — `/api/oauth/revoke` (RFC 7009) accepts a refresh token and revokes it immediately. Previously-issued access tokens remain valid until their 1-hour JWT expiry.
- **Firebase Admin SDK** — used server-side only to verify ID tokens and access Firestore. The service account credentials never leave the server.

---

## How the OAuth flow works

```
MCP client → GET /api/mcp (no token)
  ← 401  WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"

MCP client → GET /.well-known/oauth-protected-resource
  ← { authorization_servers: ["https://app.mindraft.app"] }

MCP client → GET /.well-known/oauth-authorization-server
  ← { authorization_endpoint: "/connect", token_endpoint: "/api/oauth/token", … }

MCP client → opens browser to /connect?session=<id>
  user signs in with Google
  browser → POST /api/oauth/callback  { idToken, session }
  server verifies ID token, issues short-lived code
  browser redirects back to MCP client with ?code=…

MCP client → POST /api/oauth/token  { grant_type: "authorization_code", code, code_verifier }
  ← { access_token, token_type: "bearer", expires_in: 3600, refresh_token }

MCP client → POST /api/mcp  Authorization: Bearer <access_token>
  ← MCP tool responses

# When the access token expires, the client silently refreshes:

MCP client → POST /api/oauth/token  { grant_type: "refresh_token", refresh_token }
  ← { access_token, token_type: "bearer", expires_in: 3600, refresh_token: <rotated> }

# On disconnect, the client can revoke its refresh token:

MCP client → POST /api/oauth/revoke  { token: <refresh_token> }
  ← 200 OK
```

---

## Troubleshooting

**"Missing Firebase Admin credentials"** — `FIREBASE_CLIENT_EMAIL` or `FIREBASE_PRIVATE_KEY` is not set. Check your `.env.local` file and restart the server.

**"invalid_grant: PKCE verification failed"** — The MCP client sent a mismatched `code_verifier`. This is usually a client bug; try restarting the MCP client and reconnecting.

**"Code expired or already used"** — Auth codes expire in 5 minutes. Start the sign-in flow again.

**"invalid_grant: reused"** — A refresh token was presented twice. The server revoked the entire token family as a security measure. The MCP client will automatically trigger a fresh authorization flow (browser sign-in) on next use.

**"invalid_grant: expired"** — The 30-day absolute refresh token lifetime has passed. Sign in again.

**Private key format errors** — Make sure the key in `.env.local` uses literal `\n` sequences. A correctly formatted key looks like: `"-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"` (one long line with `\n` for each newline).

**Ideas not appearing** — The MCP server only returns ideas where `archived == false`. Archived ideas appear in `list_archived_ideas`.
