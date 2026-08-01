# Tasks Recurrence Projection Repair

## Outcome

BathOS Tasks now keeps unreached recurrence work virtual. A repeating prototype appears only in Upcoming at its next logical spawn date, with recurrence controls and without a completion checkbox. An ordinary task instance is materialized only when that date reaches the owner's current planning date.

Production data and behavior were repaired without adding tables or expanding the synchronization boundary. The matching web release was published from implementation commit `df403030518bf4aba724450ee346d79f6f8b824c`.

## Root Cause

Recurrence creation always adopted the source task as an occurrence and advanced the prototype, even when the first occurrence was in the future. The dialog also requested recurrence evaluation through future dates, and the authoritative evaluator accepted those requests. This produced ordinary Upcoming tasks before their spawn dates and advanced their virtual prototypes too far.

The same model defect affected production broadly rather than only the reported `Family event` recurrence. The exact owner-scoped preflight found 54 future adopted open projections across 60 recurrence definitions. One reached instance that had later been deferred into the future was correctly distinguished and preserved.

## Repair

Migration `20260801053549_repair_premature_recurrence_instances.sql`:

- Preserved the current task and checklist content of each unreached adopted projection in its recurrence prototype when the occurrence still belonged to the current revision.
- Removed exactly 54 premature tasks and occurrence records and rewound their definitions to the immutable scheduled date.
- Preserved the reached and subsequently deferred ordinary instance.
- Made future recurrence conversion virtual while retaining current-date adoption.
- Rejected authoritative evaluation beyond the owner-local planning date.
- Corrected generated Today instances to enter Inbox without storing a conflicting explicit Start date.

The migration is fail-closed against the audited production scope. It creates no tables, rewrites no unrelated Tasks rows, and keeps PowerSync at exactly 17 approved Tasks tables.

## Production Rollout Evidence

- Private pre-rollout backup: `/Users/Art/Library/Application Support/garden.bath.bathos/tasks-production-backups/2026-07-31T225727-0700-pre-repair-premature-recurrence.sql`
- Backup size: 9,242,102 bytes, mode `0600`
- Backup SHA-256: `38549423357e6c2d26dcf11f3a4d728aadec23408ce77420255f25950de4848f`
- Migration applied in production ledger as `repair_premature_recurrence_instances`.
- Postflight: 60 definitions, 6 adopted occurrences, 1 generated occurrence, 0 future adopted open projections, 0 future generated open projections, and 1 preserved reached/deferred instance.
- `Family event` was rewound to `2026-08-01` with evaluation through `2026-07-31`.
- Local and production hashes matched for recurrence creation, recurrence evaluation, and private occurrence instantiation functions.
- PowerSync verification reported exactly 17 synchronized Tasks tables and `ready` status.
- All three Tasks cron jobs were active with successful latest runs: due-root activation, reminder dispatch, and expired-Done purge.
- Supabase security and performance advisors returned no errors. Existing warning and informational categories were unchanged by this table-neutral, policy-neutral migration.
- Owner-scoped production acceptance passed for checklist, recurrence, terminal editing, deletion, and Done behavior. Cleanup left zero synthetic users, tasks, recurrences, or occurrences.
- Lovable deployment `63236889-2c9b-45ee-a79e-41a901d51abb` published the matching web build.
- Authenticated rendered acceptance at `https://os.bath.garden/tasks/upcoming` showed `Family event` exactly once under Saturday, August 1, with Edit Repeat and Actions controls, no completion checkbox, and no console errors or warnings.

## Validation

- Clean local database reset through the repair migration
- 29 pgTAP files and 677 database assertions passed
- 162 application test files passed with 1,298 passing and 15 skipped tests
- TypeScript, ESLint, production build, and strict OpenSpec validation passed
- Focused recurrence database coverage passed 54 assertions
- Focused application recurrence coverage passed 15 assertions
- Local database lint exited successfully with only previously documented notices

## Rollback

The private backup is the complete pre-repair recovery source. A rollback must restore that backup and redeploy the preceding application release together because the migration deliberately contracts the accepted recurrence state machine. Partial data-only reversal would recreate behavior that the repaired clients now reject.
