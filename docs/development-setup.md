# Development Setup

How to set up a local development environment for Mindraft.

## Prerequisites

- **Node.js 20+**
- **Firebase CLI**: `npm install -g firebase-tools` then `firebase login`
- **Vercel account** linked to the GitHub repo (for preview deployments)

## Quick Start

```bash
git clone git@github.com:lucascaro/mindraft.git
cd mindraft
npm install
cp .env.dev.example .env.dev   # fill in dev Firebase credentials
npm run dev:staging             # starts Next.js with dev Firebase
```

## Firebase Projects

| Environment | Project ID | Usage |
|-------------|-----------|-------|
| **Production** | `mindraft-d1a3c` | Live app, deployed from `main` |
| **Dev** | `portfolio-7cb2b` | Local dev and Vercel preview branches |

Never test directly against the production project. All development uses `portfolio-7cb2b`.

## Setting Up `.env.dev`

Copy `.env.dev` (or `.env.example`) and fill in the dev Firebase credentials:

1. Go to [Firebase Console > portfolio-7cb2b > Project Settings](https://console.firebase.google.com/project/portfolio-7cb2b/settings/general)
2. Under **Your apps**, copy the web app config values
3. Under **Service accounts**, generate a new private key (JSON)
4. Fill in `.env.dev`:
   - `NEXT_PUBLIC_FIREBASE_*` — from the web app config
   - `FIREBASE_CLIENT_EMAIL` — from the service account JSON (`client_email`)
   - `FIREBASE_PRIVATE_KEY` — from the service account JSON (`private_key`), on a single line with `\n` for newlines
5. Generate an MCP JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Running Locally

```bash
# Against dev Firebase (recommended for feature work):
npm run dev:staging

# Against production Firebase (only if you have .env.local with prod credentials):
npm run dev
```

Both start on `http://localhost:3000`.

## Deploying Firestore Rules

After modifying `firestore.rules` or `firestore.indexes.json`:

```bash
# Deploy to dev (always do this first):
firebase use dev
firebase deploy --only firestore:rules,firestore:indexes
firebase use default

# Deploy to production (only after validating on dev):
firebase deploy --only firestore:rules,firestore:indexes
```

## Vercel Preview Deployments

Vercel auto-deploys a preview URL for every branch pushed to GitHub. Preview deployments use the dev Firebase project via Vercel's environment variable scoping (Preview-only).

### Setting up Vercel preview env vars

In [Vercel > mindraft > Settings > Environment Variables](https://vercel.com), add each variable from `.env.dev` with scope set to **Preview** (not Production). This ensures preview branches never touch production Firebase.

### Authorizing preview domains in Firebase Auth

Firebase Auth needs to know which domains are allowed for Google sign-in redirects. Add the Vercel preview URL pattern to:

1. [Firebase Console > portfolio-7cb2b > Auth > Settings > Authorized domains](https://console.firebase.google.com/project/portfolio-7cb2b/authentication/settings)
2. Add your Vercel preview domain (e.g., `mindraft-*.vercel.app` or the specific URL)

## Release Workflow

1. Create a feature branch from `main`
2. Develop locally using `npm run dev:staging`
3. Run tests: `npm run test` and `npm run test:e2e`
4. Push the branch — Vercel deploys a preview URL automatically
5. Validate the preview deployment works correctly
6. Run `npm run build` to verify the production build
7. Merge to `main` — Vercel deploys to production

## Testing

```bash
npm run test        # Unit tests (vitest)
npm run test:e2e    # E2E tests (playwright)
npm run build       # Production build (catches type errors)
```

All three must pass before merging to `main`.
