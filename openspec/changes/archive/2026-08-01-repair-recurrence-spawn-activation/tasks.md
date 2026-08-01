## 1. Diagnose And Specify

- [x] 1.1 Reproduce the production recurrence state and identify the cadence-date versus spawn-date mismatch
- [x] 1.2 Define authoritative owner-local background spawning and bounded foreground evaluation in OpenSpec

## 2. Database Repair

- [x] 2.1 Add a private spawn-date helper and owner-parameterized recurrence evaluator
- [x] 2.2 Make authenticated recurrence evaluation delegate through the planning-date boundary
- [x] 2.3 Make owner-local activation generate due recurrence instances and advance prototypes transactionally
- [x] 2.4 Persist the projected Start, Today Inbox placement, and cadence-derived Deadline on reached generated instances
- [x] 2.5 Add guarded migration-time repair and postconditions for due recurrence definitions

## 3. Client And Tests

- [x] 3.1 Remove client compensation that evaluates recurrence beyond the planning date
- [x] 3.2 Add database regression coverage for early-Start recurrence spawning, idempotency, and prototype advancement
- [x] 3.3 Add application regression coverage for planning-date recurrence evaluation
- [x] 3.4 Run database tests, application tests, TypeScript, lint, build, and strict OpenSpec validation

## 4. Production Rollout

- [x] 4.1 Refresh and verify the private production Tasks backup and repeat the exact recurrence preflight
- [x] 4.2 Apply the migration and verify the repaired instance and advanced prototype
- [x] 4.3 Verify cron, PowerSync table count, advisors, migration parity, and rendered Today and Upcoming behavior
- [x] 4.4 Sync and archive the OpenSpec change, commit and push main, and prove the repository clean and synchronized
