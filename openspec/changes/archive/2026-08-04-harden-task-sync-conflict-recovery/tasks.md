## 1. Conflict Recovery Core

- [x] 1.1 Rebase stale task PATCH fields onto the latest remote revision with stable mutation identity and contiguous revisions
- [x] 1.2 Recognize already-applied rebased mutations without duplicate writes or history
- [x] 1.3 Retain exhausted or missing-task conflicts in PowerSync's durable queue
- [x] 1.4 Upsert content-free conflict receipts from pending to recovered

## 2. Verification Coverage

- [x] 2.1 Replace first-writer-wins connector coverage with successful rebase, unrelated-field preservation, and stable-idempotency cases
- [x] 2.2 Cover bounded repeated conflict and missing-task retention without transaction completion
- [x] 2.3 Update multi-client convergence coverage to require replayed offline edits rather than silent loss
- [x] 2.4 Add a planning-edit race case matching due-task activation

## 3. Validation

- [x] 3.1 Run focused connector and convergence tests
- [x] 3.2 Run Tasks sync tests, TypeScript build, lint for touched files, and OpenSpec validation
- [x] 3.3 Audit implementation against every change requirement and confirm no task-content diagnostics or production migration
