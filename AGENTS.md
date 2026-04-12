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
