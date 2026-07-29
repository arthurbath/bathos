# Things-To-Tasks Authoritative Cutover

**Date:** 2026 Jul 28
**Category:** Product / Production / Trust
**Status:** Accepted

## Outcome

BathOS Tasks is now the owner's authoritative task system. The approved open
Things corpus was migrated through a private, read-only, integrity-checked
snapshot. Things Logbook and Trash were excluded. The owner Tasks corpus was
replaced atomically only after a fresh verified private PostgreSQL backup and a
schema-13 logical backup were prepared.

The installed Inbox Manager runtime now sends new Mail-created tasks only to
BathOS Tasks. The canonical Raycast reading-list command also sends only to
BathOS Tasks. Both paths retain one AI refinement per source item and perform no
Things write, credential, or Automation work.

## Private Source And Mapping Evidence

The private snapshot selected 139 approved Things records and produced 129
visible BathOS Tasks, two Areas, 93 checklist items, and 60 recurrence
definitions, revisions, and adopted occurrences. The difference is intentional:
open child tasks from the two Things template Projects became checklist items
inside ordinary `TEMPLATE` tasks instead of separate visible tasks.

The migration produced these content-free planning totals:

- 30 Anytime tasks
- 23 Someday tasks
- 67 future-Start tasks
- 9 Today Inbox tasks

The owner-local cutover date was 2026 Jul 28 in
`America/Los_Angeles`. Today planning is stored under the exclusive Tasks model
as a null `start_date` with `today_section = inbox`. Future Starts remain
date-only values, so a Start of 2026 Aug 1 means that calendar date in the
owner's planning time zone rather than a converted UTC instant.

Exact Things hourglass and repeat-cycle tags mapped to Waiting and Rechecking.
Untagged work mapped to Ready. Area names mapped one-to-one. Titles, leading
emoji, notes, deadlines, supported Primary Links, and supported recurrence
semantics were retained. Things tags, identifiers, headings, and relationship
metadata were not embedded in Tasks.

## Recurrence And Replacement Corrections

The client and database recurrence evaluators now support the observed explicit
yearly fixed-date and ordinal-weekday patterns. Every decoded recurrence was
checked against the Things next-instance value before migration.

The first replacement preview exposed two fail-closed compatibility defects:
the migration tool initially generated order keys outside the application's
fractional-indexing language, and schema-13 replacement attempted to delete
immutable recurrence rows outside the private restore context. The final
envelope uses the same fractional key sequence as ordinary Tasks mutations.
Migration `20260729060532_restore_recurrence_replace_deletions.sql` establishes
the private restore context before dependency-ordered deletion and keeps
ordinary user deletion blocked. Local pgTAP passed 711 assertions after that
correction.

## Production Acceptance

The accepted replacement request produced a schema-13 corpus whose export,
after excluding the generated export timestamp, has SHA-256 digest
`ac75fd9e0f458c541803617d84beb59856f78f37b5881f3dc5025ccc81a8522f`.
A final independent production export returned the same digest and exact
aggregate counts:

- 129 Tasks
- 2 Areas
- 93 checklist items
- 9 open Today Inbox tasks
- 67 open future-Start tasks
- 23 open Someday tasks
- 0 legacy migration order keys
- 0 disposable Mail or Raycast fixture tasks

Authenticated rendered verification independently showed nine Today task rows,
23 Someday task rows, future date buckets beginning 2026 Jul 29 and including
2026 Aug 1, and the native Repeating Tasks section. The rendered counts and
planning buckets agree with the production export.

The exact synchronization and scheduling boundary remains:

- exactly 20 published Tasks tables and zero non-Tasks tables
- exactly 20 `SELECT` grants to `tasks_powersync_role` and zero non-Tasks table
  grants
- the approved role retains `LOGIN`, `REPLICATION`, and `BYPASSRLS`
- the activation, reminder, and Done-retention jobs are active once per minute

Current Supabase advisors contain the documented existing private-table RLS,
authenticated `SECURITY DEFINER`, foreign-key-index, RLS-init-plan, permissive
policy, duplicate-index, and unused-index findings. No new table, publication,
role, owner-isolation, or cutover-specific advisor regression was introduced.
The relevant remediation references remain the Supabase
[security advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
and
[performance advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Native Checklist Reconciliation

The original extractor did not read Things' native `TMChecklistItem` table.
The 2026 Jul 29 reconciliation added the omitted 229 native checklist items to
41 exact deterministic Task targets, including 70 checked items, without
changing any Task row. Production now contains 322 owner checklist items.
Exact source hashes, order, checked state, completion timestamps, the unchanged
Task digest, fresh PowerSync projection, rendered behavior, scheduling, and the
20-table publication boundary passed. The content-free evidence and bounded
nested-project and immutable-recurrence-template exceptions are recorded in
`2026-07-29_things_checklist_reconciliation.md`.

## Capture Cutover Acceptance

Inbox Manager is installed in persistent `bathos-only` mode with no expiry. Its
final inspection reported an empty authoritative queue, no current failure or
retry, healthy ordinary Mail automation, and no item or enrichment incidents.
A disposable natural Mail replay created exactly one Today Inbox task, one
structured Mail source, and one creation event with a valid append key. The
fixture was then removed.

The canonical Raycast webpage command reauthorized after correctly discarding a
stale rotating refresh token. Its disposable production acceptance created
exactly one Today Inbox reading task with one structured browser-capture source
and one creation event. That fixture was also removed. Neither accepted path
invoked Things.

## Validation

- BathOS application: 1,104 passed tests and 15 opt-in skips
- BathOS database: 711 passed pgTAP assertions
- BathOS migration tool: 7 passed synthetic tests
- BathOS Tasks TypeScript: passed
- BathOS lint: zero errors and one pre-existing Fast Refresh warning
- BathOS production build: passed
- BathOS strict OpenSpec validation: 18 passed items
- Inbox Manager: 241 passed tests, 181 Mail-rule cases, and 8 strict OpenSpec
  items
- Raycast: 23 passed tests, shell syntax passed, and `git diff --check` passed

## Recovery Boundary

The verified private production backup and schema-13 replacement backup remain
the recovery authorities. The private Things snapshot and generated envelope
are not repository artifacts and contain no committed personal content. A
rollback must restore the verified Tasks backup, restore the prior capture
runtimes, and re-prove Tasks, PowerSync, scheduling, and capture-path parity
before mutation resumes.
