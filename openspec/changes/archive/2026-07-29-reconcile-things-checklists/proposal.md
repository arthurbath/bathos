## Why

The authoritative Things-to-Tasks cutover preserved project children as checklist items but omitted Things' native `TMChecklistItem` rows from ordinary and recurring tasks. The private source remains available and the imported Tasks records retain deterministic identifiers, so the missing checklist content can be reconciled without changing task planning or guessing among duplicate titles.

## What Changes

- Extend the private Things migration extractor to validate and preserve native checklist rows, their source order, and checked state.
- Reconcile the omitted checklist rows into the exact imported production Tasks records only after deterministic identifier and exact title agreement.
- Make reconciliation idempotent, content-private, atomic, and recoverable from a fresh verified private Tasks backup.
- Fail closed on source drift, target ambiguity, pre-existing unexpected checklist content, unsupported checklist status, or any aggregate mismatch.
- Prove checked and unchecked state, ordering, PowerSync projection, rendered behavior, and zero non-checklist task-field mutation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `things-cutover-migration`: Preserve native Things checklist items and define the guarded post-cutover reconciliation for the omitted production rows.

## Impact

- Migration tooling and synthetic migration tests under `scripts/`.
- The durable Things cutover migration specification.
- One owner-private Things snapshot and one owner-private production Tasks backup.
- Owner-scoped rows in `public.tasks_checklist_items`; no schema, PowerSync publication, recurrence rule, capture-path, or task-planning change.
