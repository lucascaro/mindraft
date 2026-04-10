@AGENTS.md

## Development Standards

### Testing Requirements
- Every feature or bug fix must include corresponding tests before being considered complete.
- Unit tests (vitest) for business logic and utilities.
- E2E tests (playwright) for user-facing behavior changes.
- Tests are part of the definition of done, not an afterthought.
- Run `npm run test` and `npm run test:e2e` to verify before submitting changes.
