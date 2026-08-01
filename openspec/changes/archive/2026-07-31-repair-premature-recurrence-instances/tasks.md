## 1. Authoritative Recurrence Boundaries

- [x] 1.1 Update recurrence creation so future source tasks become virtual prototypes and current-date source tasks remain adopted instances.
- [x] 1.2 Reject evaluator requests beyond the owner-local planning date and remove repeat-dialog future evaluation.
- [x] 1.3 Make the client recurrence creation response accept a nullable occurrence.

## 2. Owner Data Repair

- [x] 2.1 Add a fail-closed migration that snapshots and removes exactly the audited premature adopted projections while rewinding their definitions.
- [x] 2.2 Preserve reached and deferred instances and keep PowerSync at exactly 17 approved Tasks tables.

## 3. Verification and Rollout

- [x] 3.1 Add pgTAP and application tests for future conversion, current-date adoption, evaluation rejection, and nullable responses.
- [x] 3.2 Run database, application, type, lint, build, and strict OpenSpec validation locally.
- [x] 3.3 Refresh and verify the private production backup, apply the migration, and run and clean up owner-scoped recurrence acceptance fixtures.
- [x] 3.4 Verify PowerSync, cron, advisors, production parity, and rendered prototype/instance behavior.
- [x] 3.5 Publish the matching web release, sync and archive the OpenSpec change, commit and push main, and prove the repository clean and synchronized.
