## 1. Local Planning Activation

- [x] 1.1 Extend the local Tasks repository activation query to include reached deadline-only work while preserving explicit Start precedence
- [x] 1.2 Verify Upcoming continues to expose the deadline as an implicit controlling date without persisting or displaying a Start before activation

## 2. Server Planning Activation

- [x] 2.1 Add a forward-only migration that updates `tasks_private.activate_due_roots` with matching deadline eligibility, ordering, and idempotence
- [x] 2.2 Preserve ordinary revision history, Today Inbox ordering, and deadline metadata for newly activated work

## 3. Verification

- [x] 3.1 Add repository and domain tests for reached deadlines, future deadlines, and explicit Start precedence
- [x] 3.2 Add database rollover coverage for owner-local deadline activation, catch-up, ordering, and no-op retries
- [x] 3.3 Run focused tests, TypeScript validation, database tests, and strict OpenSpec validation, documenting any unrelated pre-existing blockers
