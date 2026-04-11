@AGENTS.md

## Development Workflow

### Branch-Based Development
Features are developed on branches, validated via Vercel preview deployments, then merged to `main` for production release.

1. Create a feature branch from `main`
2. Develop and test locally against the **dev** Firebase project: `npm run dev:staging`
3. Push the branch — Vercel auto-deploys a preview URL with dev Firebase credentials
4. Validate on the preview deployment
5. Merge to `main` — Vercel deploys to production with production Firebase

### Firebase Environments
| Environment | Project ID | Purpose |
|-------------|-----------|---------|
| **Production** | `mindraft-d1a3c` | Live app — never test directly against this |
| **Dev** | `portfolio-7cb2b` | Development and preview deployments — safe to break |

- Run locally against dev: `npm run dev:staging` (uses `.env.dev`)
- Deploy Firestore rules to dev: `firebase use dev && firebase deploy --only firestore:rules,firestore:indexes && firebase use default`
- Deploy Firestore rules to production: `firebase use default && firebase deploy --only firestore:rules,firestore:indexes`

## Development Standards

### Testing Requirements
- Every feature or bug fix must include corresponding tests before being considered complete.
- Unit tests (vitest) for business logic and utilities.
- E2E tests (playwright) for user-facing behavior changes.
- Tests are part of the definition of done, not an afterthought.
- Run `npm run test` and `npm run test:e2e` to verify before submitting changes.
