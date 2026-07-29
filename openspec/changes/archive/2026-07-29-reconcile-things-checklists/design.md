## Context

The authoritative Things cutover deliberately converted open Things project children into BathOS checklist items. The extractor did not validate or read Things' separate `TMChecklistItem` table, so native checklist rows attached to ordinary and recurring Things tasks were omitted. Imported task identifiers remain deterministic and production task content has not changed except for later Start planning.

The current private Things snapshot contains 229 native checklist rows attached directly to 41 imported task targets. Seventy are completed. A further 108 rows belong to former project-child tasks that were intentionally collapsed into checklist items during the project-free cutover and therefore have no task target capable of owning a nested checklist.

## Goals / Non-Goals

**Goals:**

- Preserve native Things checklist text verbatim, source order, and completion state.
- Reconcile only exact imported task targets whose deterministic identifier and title both agree.
- Make the extractor preserve recurrence template checklists for any future cutover.
- Make the repair idempotent, atomic, content-private, and recoverable from a fresh verified backup.
- Leave every task field, task revision, planning value, and capture path unchanged.

**Non-Goals:**

- Flatten nested checklist rows from former Things project children.
- Recreate Things projects or relationship metadata.
- Match a task by title alone or guess among duplicate titles.
- Change Tasks schema, PowerSync publication, recurrence rules, or user-authored post-cutover checklist content.

## Decisions

### Use deterministic identifiers with exact title agreement

The original cutover generated task identifiers from Things source UUIDs. Reconciliation will derive the same identifiers and require the production title to equal the currently selected source title. This is stronger than the requested title-only match, avoids duplicate-title ambiguity, and independently detects source drift.

### Preserve native checklist rows without normalization

Each source checklist UUID receives a deterministic target identifier. The stored title is copied without trimming or rewriting, order follows Things `index` with UUID as a stable tie-breaker, status `0` becomes unchecked, and status `3` becomes checked with the source completion time. Empty titles, unsupported statuses, or completed rows without a completion time stop the repair.

### Repair current tasks without rewriting immutable recurrence revisions

For a new cutover, the visible adopted recurrence task receives the checklist from its current Things occurrence, or from the template when no open occurrence exists. The generated template snapshot receives the template checklist as unchecked blueprint nodes so later generated occurrences retain the checklist structure. Completion state belongs only to the current occurrence and is not copied into future work.

The production correction inserts checklist rows only. Existing production
template revisions are immutable by contract and cannot be edited in place.
Retrofitting their nine affected blueprints would require nine new template
revisions plus matching recurrence revisions and is intentionally reserved for
a separately approved change. The extractor fix ensures a future replacement
would build those blueprints correctly.

### Require an empty target boundary

The repair expects every deterministic native checklist identifier to be absent and each affected task to have no existing checklist content. Any unexpected existing row stops the transaction. A replay after successful application is accepted only when every expected row already matches exactly.

### Exclude nested project-child checklists

The 41 native checklist rows attached to former Things project-child tasks cannot be represented without either nesting checklists or inventing a flattening convention. They remain excluded and are reported as a bounded, explicit exception. No personal content is emitted in the report.

## Risks / Trade-offs

- The Things database changed after the original snapshot. Deterministic task identifiers plus exact title agreement prevent newer unrelated source work from attaching to imported targets.
- A task title changed only in Things after cutover. That target fails closed and requires a deliberate exception rather than receiving possibly stale content.
- Production already contains user checklist edits. The empty-boundary guard stops rather than overwriting or interleaving them.
- Existing recurrence blueprints remain empty until a separate new-revision
  operation is approved. Current adopted recurrence tasks receive their source
  checklist content in this repair.

## Migration Plan

1. Extend and test the private extractor against synthetic native checklist rows.
2. Build a content-private reconciliation manifest from the immutable Things snapshot.
3. Compare every deterministic task and template target to a fresh production export.
4. Refresh and verify the private schema-13 Tasks backup and record its digest.
5. After explicit approval, apply one owner-scoped transaction that inserts the missing current checklist rows without updating Tasks or immutable recurrence records.
6. Verify aggregate counts, checked state, ordering, zero task-row mutation, PowerSync projection, rendered behavior, cron, advisors, and repository parity.

Rollback restores the verified pre-reconciliation schema-13 owner export. No source database mutation or Things write is involved.
