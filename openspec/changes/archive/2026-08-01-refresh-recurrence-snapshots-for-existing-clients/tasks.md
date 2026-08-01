## 1. Contract and migration

- [x] 1.1 Add a fail-closed migration that re-emits existing recurrence snapshots without changing their values.
- [x] 1.2 Add database regression coverage for exact row, snapshot, revision, and timestamp preservation.

## 2. Verification and rollout

- [x] 2.1 Run focused and full database validation, application checks, and strict OpenSpec validation.
- [x] 2.2 Refresh and verify the private production backup and exact recurrence preflight.
- [x] 2.3 Apply the migration and prove recurrence hashes, PowerSync topology, and production rendering.
- [x] 2.4 Sync and archive this OpenSpec change, commit all intended work, push main, and prove the repository is clean and synchronized.
