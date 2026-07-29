# Things Checklist Reconciliation

**Date:** 2026 Jul 29
**Category:** Product / Production / Trust
**Status:** Accepted

## Outcome

The authoritative Things-to-Tasks cutover omitted Things' native
`TMChecklistItem` rows. The extractor now validates and preserves those rows,
and the missing current-task checklist content has been reconciled into
production without changing any Task field, planning value, revision, capture
path, or recurrence revision.

The accepted owner-scoped transaction inserted:

- 229 native checklist items
- 41 exact deterministic Task targets
- 70 checked items
- 159 unchecked items

Every inserted row matches the current private Things source on deterministic
identifier, parent Task, verbatim title hash, source order, checked state, and
completion timestamp. The 41 affected Task rows retain their exact pre-write
digest, and the import left zero user-facing checklist history events.

## Safety And Recovery

The current Things database and its current private backup agreed on the
content-free checklist aggregates and deterministic target guards. The repair
required both the deterministic Task identifier and exact title hash to match.
Every affected Task had to contain no checklist rows before application.

The verified private production backup is:

`/Users/Art/Library/Application Support/garden.bath.bathos/tasks-production-backups/2026-07-29T071035-0700-pre-things-checklist-reconciliation.sql`

Its SHA-256 digest is
`7f2bcc44a4b2dbe33654d0afa15162deeb96f4e00c92beeb69d589f0cae8d7f3`.
The file is private, has mode `0600`, contains the required public and private
Tasks collections, and ends with PostgreSQL's successful dump marker.

Two broader candidate transactions failed closed and rolled back before the
accepted write. The first attempted a database setting unavailable to the
managed migration role. The second correctly encountered the contract that
existing template revisions are immutable. The accepted transaction therefore
inserted only current-task checklist rows.

## Bounded Exceptions

The source contains 108 native checklist rows under former Things project-child
tasks. Those child tasks were deliberately collapsed into checklist items
during the project-free cutover, and BathOS does not support checklists nested
inside checklist items. The reconciliation reports and excludes those rows
rather than inventing a flattening rule.

Nine existing recurrence templates contain 44 unchecked source blueprint rows.
Their current adopted Tasks received their source checklist content, but the
immutable production template revisions were not rewritten. Preserving those
blueprints for future generated occurrences requires new template and
recurrence revisions under a separately approved change. The extractor now
includes those blueprints correctly for any future replacement cutover.

## Production Acceptance

The final read-only postflight proved:

- 229 expected and 229 exact production rows
- 70 checked production rows
- 41 affected Tasks
- unchanged affected-Task digest
  `071f8594b63169cb8cf5526cf02c3b0c`
- 131 total owner Tasks
- 322 total owner checklist items
- zero import-generated checklist history events
- exactly 20 published Tasks tables

An affected Task was then opened through the authenticated production
application after PowerSync projection. Its metadata drawer rendered all 18
expected checklist items, including the exact expected split of 12 checked and
six unchecked items.

The activation, reminder-dispatch, and Done-retention jobs remain active once
per minute. Current Supabase security and performance advisors contain no
errors and no reconciliation-specific finding. The existing documented
platform findings remain unchanged in scope.

## Validation

The extractor's synthetic suite covers ordinary Tasks, adopted recurrence
Tasks, recurrence-template blueprints, verbatim title preservation, source
order, checked state, completion timestamp, and fail-closed source validation.
The completed release gates are:

- 7 passed extractor tests
- 1,123 passed application tests and 15 intentional skips
- Tasks TypeScript passed
- lint passed with zero errors and one pre-existing Fast Refresh warning
- production build passed
- strict OpenSpec validation passed all 20 items

The archived `reconcile-things-checklists` OpenSpec change records the durable
contract and implementation checklist.
