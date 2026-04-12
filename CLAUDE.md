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

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
