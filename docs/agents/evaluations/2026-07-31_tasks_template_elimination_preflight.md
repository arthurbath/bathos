# Tasks Template Elimination Release

**Date:** 2026-07-31  
**Status:** Production conversion complete; matching client publication in progress

## Decision

Templates are removed from the current Tasks product and data model. Repeating to-dos now use first-class recurrence prototypes that appear only in Upcoming. A calendar prototype occupies its next spawn date, creates an ordinary independently editable task instance when reached, and advances to its following spawn date. An after-completion prototype waits in the Repeating Tasks section while its latest instance remains open.

The prototype's immutable recurrence revision owns the content copied into every new instance. Changes made to a spawned instance do not modify the prototype or influence later instances.

## Local implementation

- Removed the Templates route, navigation, views, hooks, services, MCP operations, PowerSync collections, portability collection, and current generated types.
- Redirected the retired `/tasks/templates` route to Upcoming.
- Replaced materialized future prototype task rows with Upcoming projections built from recurrence definitions and revisions.
- Preserved spawned instances as ordinary tasks in every list, Quick Find, widgets, keyboard workflows, and Done.
- Added prototype editing for Summary, Notes, Primary Link, Area, Actionability, and checklist content.
- Advanced Tasks portability to schema 14 while retaining narrow legacy import support.
- Contracted the intended Tasks PowerSync publication and client schema from 20 to 17 tables.

## Read-only production preflight

The preflight made no production changes and disclosed only aggregate counts.

| Contract | Count |
|---|---:|
| Active recurrence definitions | 60 |
| Calendar definitions | 52 |
| After-completion definitions | 8 |
| Recurrence revisions to convert | 62 |
| Occurrence rows to preserve | 62 |
| Template rows to remove | 60 |
| Template revision rows to remove | 60 |
| Template instantiation rows to remove | 2 |
| Templates unrelated to recurrence | 0 |
| Old future materialized prototype task rows to remove | 1 |
| Checklist rows attached to removed projection tasks | 0 |
| Reached generated ordinary instances to preserve | 1 |
| Future adopted ordinary instances to preserve | 54 |
| Invalid snapshot links | 0 |
| Invalid occurrence owner or root relationships | 0 |
| Duplicate future projection recurrences | 0 |
| Tasks rows before conversion | 227 |
| Checklist rows before conversion | 334 |
| Current PowerSync Tasks tables | 20 |
| Required post-rollout PowerSync Tasks tables | 17 |

The migration contains fail-closed assertions for these relationships and refuses to proceed if the production shape changes incompatibly before rollout.

## Migration order

1. `20260731011500_preserve_upcoming_order_on_start_activation.sql`
2. `20260731132825_eliminate_task_templates_and_simplify_recurrence.sql`

Both migrations are recorded in the production migration ledger.

## Production conversion

The final verified private backup is
`2026-07-31T081316-0700-pre-eliminate-task-templates.sql`. It is a complete
data-only PostgreSQL dump with mode `0600`, a stable size of 8,996,493 bytes,
and SHA-256
`c3e444a1a983aa85154a50e4d68c248b38671dd6d626bf3495056bbfb6406960`.

The fail-closed conversion completed with the approved shape:

- 60 recurrence definitions and 62 recurrence revisions were converted to
  first-class prototype snapshots.
- 1 reached generated instance and 54 future adopted instances were retained
  as ordinary to-dos.
- 1 obsolete future projection was removed.
- 60 template rows, 60 template revisions, and 2 template-instantiation rows
  were removed.
- Zero legacy Template source-provenance rows remain.
- PowerSync contains exactly the 17 approved Tasks tables.

The template-free MCP Edge Function is active as version 17 with platform JWT
verification disabled as intended. Its deployed source SHA-256 is
`5088a402c0054b20bac99d06b3a38e6ce10109f2c6cabb9d178b92c92bd80af3`.

## Production acceptance

The owner-scoped production acceptance fixture proved checklist persistence,
calendar recurrence creation and evaluation, an adopted occurrence, one newly
generated ordinary instance, terminal editing, Done restoration, fresh
PowerSync projection, and complete owner cleanup. The fixture passed in 9.124
seconds and left zero owner rows in to-dos, checklist items, recurrence
definitions, revisions, or occurrences.

The reached-Start activation and reminder-dispatch jobs remain active on
`* * * * *`. Their three latest inspected executions all succeeded. The linked
database linter continues to report only the existing unrelated Drawers errors
and existing Tasks warnings. It found no removed Template relation or new
Tasks blocker.

## Validation evidence

- Database: 28 files, 649 assertions passed
- Application: 1,260 tests passed, 15 skipped
- Tasks TypeScript: passed
- ESLint: passed
- Production build: passed
- Tasks MCP Edge bundle verification: passed
- Strict OpenSpec validation: 30 items passed
- Production Tasks cron jobs: all three active, one-minute schedules, latest executions succeeded
- Production Tasks Edge Functions: active
- Linked database lint: no new Tasks blocker; unrelated preexisting Drawers errors and existing Tasks warnings remain

## Remaining release proof

The matching Lovable web publication, iOS installation, final rendered checks,
and OpenSpec archival are recorded when their post-deployment verification is
complete.
