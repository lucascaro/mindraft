<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Environments

There are two Firebase projects: **production** (`mindraft-d1a3c`) and **dev** (`portfolio-7cb2b`). All development and testing uses the dev project. Production is only affected by merging to `main`.

### Firestore Rules
When modifying `firestore.rules`, deploy to the dev project before testing:
```bash
firebase use dev && firebase deploy --only firestore:rules,firestore:indexes && firebase use default
```

### Releasing Changes
Changes are validated on a Vercel preview deployment (auto-deployed per branch) before merging to `main`. The preview deployment uses the dev Firebase project, so production data is never at risk during development.

<!-- BEGIN HIVESMITH -->
## Hivesmith workflow

This project uses [hivesmith](https://github.com/lucascaro/hivesmith) skills for feature work. Keep the build/test commands below current — skills read this block to calibrate their work.

**Feature pipeline:** `/hs-feature-next` → (`/hs-feature-new` or `/hs-feature-ingest <#>`) → `/hs-feature-triage` → `/hs-feature-research` → `/hs-feature-plan` → `/hs-feature-implement` → `/hs-review-pr`

Features live under `features/` (`active/`, `completed/`, `rejected/`). `features/BACKLOG.md` and the per-feature files under `features/active/` are the source of truth for work in flight.

**Changelog:** user-visible changes go under `## [Unreleased]` in `CHANGELOG.md` via `/hs-changelog-update`. `/hs-release` stamps the date and cuts the tag — do not edit release dates by hand.

**Build / test / lint commands** — `/hs-feature-implement` expects all of these to pass before opening a PR:

- **Build:** `<command>`
- **Lint:** `<command>`
- **Tests:** `<command>`
- **Everything:** `<single command that runs all of the above>`
<!-- END HIVESMITH -->
