## 1. Optimistic Bulk Deletion

- [x] 1.1 Launch selected task deletions together and reuse one operation ID for the group
- [x] 1.2 Reconcile every persistence result while preserving the existing per-task optimistic rollback
- [x] 1.3 Emit one privacy-safe console and Sentry diagnostic for a partial or complete group failure

## 2. Verification

- [x] 2.1 Add focused shell tests for concurrent start and shared operation grouping
- [x] 2.2 Add focused task-list tests for grouped optimistic removal and selective rollback
- [x] 2.3 Add diagnostic tests that prove content-free Sentry context and client-availability behavior
- [x] 2.4 Run focused tests, TypeScript, lint, build, OpenSpec validation, and non-destructive rendered browser QA
