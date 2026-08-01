# Tasks Recurrence Spawn Activation Repair

## Outcome

The production recurrence named `Manage debt, budgets` now has one ordinary task instance with Start `2026-08-01`, Deadline `2026-08-05`, and Today Inbox placement. Its repeating prototype advanced to cadence date `2026-09-05`, which projects to Start `2026-09-01` in Upcoming.

## Root Cause

The recurrence revision uses a four-day deadline offset. The client projected the prototype into Upcoming on the earlier Start date, but the authoritative evaluator compared the later cadence date directly with the planning date. The owner-local minute activation job also activated ordinary task roots without evaluating due recurrence prototypes. Consequently, the prototype could remain in a reached Upcoming bucket until a foreground client evaluated it.

## Repair

- Added `tasks_private.recurrence_spawn_date` so authoritative due checks use cadence date minus deadline offset.
- Made the owner-local minute activation job evaluate reached recurrence prototypes before activating ordinary task roots.
- Kept cadence dates as immutable occurrence receipts and generated deadlines while persisting the projected Start date and Today Inbox on reached instances.
- Preserved idempotency through existing evaluation and occurrence identities.
- Restricted client evaluation to the owner planning date and removed the former future-date compensation.
- Added database and client regression coverage for an exact early-Start monthly recurrence.

## Production Evidence

- Private backup: `/Users/Art/Library/Application Support/garden.bath.bathos/tasks-production-backups/2026-08-01T065525-0700-pre-repair-recurrence-spawn-activation.sql`
- Backup size: `9,391,009` bytes, mode `0600`
- Backup SHA-256: `e0395dafa32f3b0e8906be43b335f2f7243181461b0cd29e71af3e3946802b89`
- Applied migration: `20260801101500_repair_recurrence_spawn_activation.sql`
- Affected occurrence count: exactly `1` for logical key `calendar:2026-08-05`
- Generated task: open and present, Start `2026-08-01`, Deadline `2026-08-05`, Today Inbox, six checklist items, and recurrence provenance intact
- Prototype: next cadence `2026-09-05`, projected spawn `2026-09-01`
- Reached prototype count after repair: `0`
- PowerSync table count: exactly `17` approved Tasks tables
- Owner-local cron: active and succeeded after deployment
- Advisor findings attributable to the new recurrence helper, evaluator, or activation path: `0`
- Lovable deployment: `a9ede825-0793-4f04-8621-65a93c0b24ce`
- Published implementation commit: `ed966864cfd9524e05be34f50def323b96b62f11`
- Rendered acceptance: Today shows the ordinary `Manage debt, budgets` task, Upcoming has no August 1 bucket, and the prototype appears under September 2026
- Production browser errors during acceptance: none

## Validation

- Clean local database reset through the repair migration
- Focused recurrence database suite: `74/74`
- Full database suite: `29` files and `698` assertions
- Full application suite: `162` passed files, `8` skipped; `1303` passed tests, `15` skipped
- Tasks TypeScript check, lint, and production build passed
- Strict OpenSpec validation passed for all `19` durable specifications after archival

## Rollback

Restore the private pre-repair backup and republish the preceding application commit only if production validation reveals a regression. The repair is otherwise forward-only because production has already generated the missing authoritative occurrence and advanced its prototype.
