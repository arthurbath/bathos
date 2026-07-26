## 1. Server Rollover

- [x] 1.1 Generate a Supabase migration and add private per-owner planning-day rollover state.
- [x] 1.2 Extend the existing due-root activation transaction to reset eligible tasks to Inbox before activating reached Starts.
- [x] 1.3 Preserve original reminder dates during rollover and retain the existing private execution boundary and Cron schedule.
- [x] 1.4 Add database acceptance coverage for time zones, ordering, exclusions, reminders, history, and idempotency.

## 2. Local and Offline Rollover

- [x] 2.1 Extend local-only owner state with the last observed planning date and migration-safe initialization behavior.
- [x] 2.2 Add repository rollover behavior that revises only eligible Today tasks and records system-authored history after upload.
- [x] 2.3 Run local rollover before reached-Start activation at startup and each minute.
- [x] 2.4 Add repository, runtime, schema, and owner-binding regression coverage.

## 3. Validation and Handoff

- [x] 3.1 Run focused tests, database tests, the full test suite, lint, build, and strict OpenSpec validation.
- [x] 3.2 Run Supabase database lint and advisors against the available local schema.
- [x] 3.3 Prepare the production migration, backup, Cron, and acceptance-fixture approval handoff without mutating production.
