## Context

The owner currently has one personal Things database, one BathOS Tasks corpus, and multiple capture paths that can write to one or both systems. Things stores open recurrence templates separately from generated occurrences, uses packed integer dates and times, and stores legacy recurrence rules as plist blobs. BathOS stores ordinary tasks separately from revisioned templates, recurrence definitions, recurrence revisions, and recurrence occurrences.

The cutover is destructive to the current Tasks corpus by design, but it must remain recoverable. Personal task content and Things identifiers are private migration inputs and cannot be committed, logged publicly, or retained as source metadata after import. Inbox Manager must preserve its one-model-call processing path while ceasing Things writes, and an accepted or retrying pre-cutover handoff cannot cross the replacement boundary unnoticed.

## Goals / Non-Goals

**Goals:**

- Produce a consistent read-only Things snapshot and deterministically map the approved open corpus into schema-13 BathOS Tasks data.
- Preserve supported task semantics, including recurrence, without duplicating a Things recurrence template and its current occurrence.
- Atomically replace the owner corpus only after a fresh verified backup, exact preflight, content-private preview, and rollback preparation.
- Make Tasks the only destination for Mail and Raycast webpage capture without adding a second OpenAI call.
- Prove source, target, production, PowerSync, scheduler, and capture-path reconciliation before declaring the cutover complete.

**Non-Goals:**

- Importing Things Logbook, Trash, headings, tags as tags, Things identifiers, or Things relationship/provenance metadata.
- Preserving a historical ordering system for the discarded Tasks test corpus.
- Writing to the live Things database or deleting Things application data.
- Backfilling historical Mail or webpage captures.
- Changing the approved 20-table PowerSync boundary.

## Decisions

### Read Things through a private immutable snapshot

Create a consistent SQLite backup from the live Things database, restrict it to the owner, verify `PRAGMA integrity_check`, record a digest, and perform every discovery and extraction read through an immutable connection.

Alternative considered: query the live database repeatedly through AppleScript. Rejected because AppleScript omits exact recurrence and reminder structures and cannot provide one stable cutover snapshot.

### Keep the extractor deterministic and content-private

A repository script will validate the expected Things schema, decode packed dates/times and plist recurrence rules, and emit a private schema-13 target envelope plus a content-free reconciliation report. Stable replacement UUIDs will be derived inside the private artifact from a migration namespace and source identities, but no source identities will be written into BathOS records, source fields, notes, or the repository.

Alternative considered: insert records incrementally through ordinary Tasks mutations. Rejected because incremental mutation makes exact rollback, complete reconciliation, and recurrence graph construction materially harder.

### Collapse each Things recurrence series to one current BathOS occurrence

For each live Things recurrence template, the extractor chooses its one open linked occurrence when present. Otherwise it materializes the template's next scheduled occurrence. That task becomes the adopted occurrence of one native BathOS recurrence. Historical linked instances are excluded with Logbook, and the separate Things template row does not become a second visible task.

Things recurrence fields map as follows:

- frequency units `16`, `256`, `8`, and `4` become daily, weekly, monthly, and yearly
- frequency amount becomes the positive interval
- repeat type `0` becomes calendar and `1` becomes after completion
- negative start offset becomes a nonnegative Deadline-to-Start offset
- zero-based Things month, month-day, and weekday values become BathOS calendar values
- monthly last-day and ordinal-weekday patterns use existing explicit monthly rule configuration
- yearly last-day and ordinal-weekday patterns use added explicit yearly rule configuration so rules such as the last day of October and second Sunday of May remain calendar-correct
- the sentinel year 4001 and zero occurrence count mean the recurrence never ends

Alternative considered: import only the next visible recurring task and discard recurrence. Rejected because recurring behavior is a core part of the approved source-of-truth cutover.

### Apply the approved semantic field mapping without provenance

- Anytime remains horizon-free Anytime.
- Someday remains Someday.
- Today retains Today planning as the Inbox horizon. In the exclusive BathOS
  storage model this is represented by `today_section = inbox` and a null
  `start_date`, while the UI and behavior still expose the task as starting
  Today.
- If the private source snapshot crosses the owner's local midnight before
  replacement, any reached or elapsed Start also enters Today Inbox, matching
  the established reached-Start and daily-rollover policy.
- A future Things Start remains a future Start with no horizon.
- Exact `⏳` maps to Waiting, exact `🔄` maps to Rechecking, and no tag maps to Ready.
- Area names map one-to-one.
- Projects become ordinary `TEMPLATE` tasks and their open child tasks become ordered plain-text checklist items.
- Titles, leading emoji, notes, Primary Links when derivable from the approved source field, deadlines, and reminder wall-clock intent are preserved.
- Things tags, headings, IDs, and relationship metadata are omitted.
- Deterministic manual ordering uses keys from the same fractional-indexing
  sequence as ordinary Tasks mutations so the imported final key remains a
  valid append boundary after cutover.

### Replace through the existing guarded schema-13 authority

Build the target from a fresh production export so owner settings and approved Areas are retained, normalizing their replacement-envelope revisions to one because they are reinserted as new baseline records, replace task-owned arrays with the imported graph, validate it with `tasks_prepare_replace_restore_v13`, and execute `tasks_replace_restore_v13` using its exact backup digest, operation identifier, and confirmation phrase. A separate private data-only PostgreSQL dump remains the last-resort recovery boundary.

Alternative considered: add a migration SQL file containing personal rows. Rejected because private content must never enter version control and the replacement is owner data, not shared schema.

### Cut capture paths over at one explicit boundary

Inbox Manager gains an operational Tasks-only mode that reuses the existing AI-refined task payload, omits the Things stage, preserves idempotent Tasks delivery, and keeps private evidence content-free. The installed runtime is reconciled before switching modes. Raycast's canonical webpage command points only to the Tasks path, and legacy Things-writing commands are retired or redirected without adding another model request.

Alternative considered: leave parallel delivery active until the user later disables Things. Rejected because the user declared this migration the authoritative cutover and continued Things writes would immediately recreate split authority.

## Risks / Trade-offs

- **A proprietary recurrence field is decoded incorrectly** -> Cross-check every decoded next date against Things' stored next-instance date, fail closed on any mismatch, and test every observed rule shape before production.
- **A recurrence template and occurrence are both imported** -> Reconcile one source series to exactly one adopted task and one recurrence definition.
- **A pre-cutover Mail retry writes after replacement** -> Drain or explicitly reconcile the pending handoff, stop the installed schedule during the boundary, and prove zero post-boundary Things work.
- **The replacement envelope omits a dependent row** -> Validate schema-13 manifests, foreign-key topology, recurrence graphs, checklist ordering, and exact content-free counts before invoking replacement.
- **Production replacement fails partway** -> Use the existing single-transaction replacement authority and retain both the schema-13 export and verified private PostgreSQL dump.
- **Private task content leaks into Git or logs** -> Keep snapshot, envelope, task-level reconciliation, and credentials outside repositories with owner-only permissions; commit only code, fixtures, and aggregate evidence.
- **A future client cannot understand yearly ordinal rules** -> Deploy the server evaluator and backward-compatible web code before importing such a rule, then verify current clients and generated dates.
- **Imported ordering blocks the first new task** -> Generate import order with
  the shared fractional-indexing sequence and run a disposable authoritative
  post-replacement creation before capture resumes.
- **Immutable recurrence triggers block replacement** -> Enter the private
  restore context for the deletion phase as well as the insertion phase and
  prove a replacement containing adopted and generated occurrences.

## Migration Plan

1. Freeze a private Things snapshot and finish aggregate discovery.
2. Implement and test the decoder, recurrence extensions, target-envelope generator, and content-free reconciliation.
3. Implement and validate Tasks-only Inbox Manager and Raycast capture behavior without deploying it.
4. Recheck installed Inbox Manager health, reconcile accepted/pending handoffs, and stop its schedule at the cutover boundary.
5. Refresh and verify the private production backup and schema-13 export.
6. Apply any backward-compatible recurrence migration and deploy the matching server/client support.
7. Preview and atomically replace the production Tasks corpus with the validated private envelope.
8. Verify exact aggregate parity, recurrence dates, reminders, PowerSync, cron, advisors, and rendered Tasks behavior.
9. Install Tasks-only capture runtimes, resume scheduling, run one disposable Mail and one webpage acceptance, and prove Things receives no new work.
10. Clean fixtures, archive the change, commit and push every affected repository, and prove clean synchronized states.

Rollback uses the verified private production dump or schema-13 replacement backup, restores the prior Inbox Manager runtime and Raycast commands, and resumes mutation only after Tasks, PowerSync, and scheduling parity are re-established.

## Open Questions

None. Any unrecognized Things schema, recurrence shape, ambiguous source series, or unreconciled capture request is a fail-closed condition rather than an implementation assumption.
