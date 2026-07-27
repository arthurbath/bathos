## Context

BathOS Tasks already persists checklist items, recurrence definitions and revisions, generated occurrences, recurrence evaluations, recoverable task lifecycle state, and deep task history. PowerSync publishes those existing tables, and the task-only hierarchy from the project-removal rollout is now the production contract. The missing work is primarily product interaction, plus a bounded recurrence-rule expansion and terminal-state mutation policy.

This change also reverses a recent shared form convention. BathOS currently suppresses unmodified Return in ordinary single-line inputs unless a form opts in. Standard web expectations and the user's observed workflows require single-line Return submission to become the default while preserving field-owned Return behavior.

The rollout crosses shared platform interaction code, Tasks UI and domain code, PowerSync upload behavior, Supabase functions and validation, durable history, and production deployment. The unrelated `raw/Module Icons.pxd` working-tree change is outside scope.

## Goals / Non-Goals

**Goals:**

- Complete a keyboard-first, directly editable checklist experience on existing task checklist persistence.
- Support calendar and after-completion recurrence authoring, bounded previews, occurrence generation, and Upcoming projection.
- Treat completed, canceled, and deleted tasks as fully inspectable and editable retained states in Done.
- Make deletion available through pointer and keyboard actions, including guarded bulk deletion.
- Preserve undo and redo for every user-visible checklist, recurrence, and lifecycle mutation.
- Apply the updated Lucide icon vocabulary consistently.
- Make Return submit ordinary forms from single-line text inputs by default without compromising multiline or composite controls.
- Preserve the exact 20-table PowerSync publication.

**Non-Goals:**

- Arbitrary recurrence expressions, natural-language recurrence parsing, or public calendar-standard import/export.
- Multiple checklists per task, Markdown checklist items, checklist-item notes, assignments, or nested checklist items.
- Permanent deletion controls in the ordinary Done interface.
- Drag reordering in Done.
- A custom pointer-drag engine or custom scrolling behavior.
- Production mutation without an explicit deployment approval.

## Decisions

### Extend the existing task hierarchy instead of introducing new entities

Checklist interaction will use `tasks_checklist_items`, and recurrence interaction will use the existing definition, revision, occurrence, evaluation, and status-event tables. No new published table is required. This preserves offline behavior, owner isolation, export/restore, and the 20-table replication boundary.

Alternative considered: store checklist and recurrence configuration as JSON on `tasks_todos`. Rejected because it would weaken independent checklist ordering/history, recurrence idempotency, synchronization convergence, and authoritative generation.

### Keep checklist editing inline and autosaved

The expanded task drawer will present one ordered checklist. A control shortcut focuses the existing checklist or creates its first item. Return creates the next row, Backspace on an already-empty row removes it and focuses the previous row, and closing the task removes all remaining empty rows. Completion moves an item after every currently incomplete item and after existing completed items. Manual reopening preserves its current position. Native HTML drag-and-drop with handles supports reordering.

Each checklist mutation will reserve a task-history operation before local acceptance. The history payload will retain the prior title, completion state, timestamp, and order key so undo restores the exact previous position. Redo reapplies the accepted result as one operation.

Alternative considered: local component-only undo. Rejected because task history is durable and shared across devices.

### Model recurrence as a revisioned rule plus immutable occurrence provenance

The existing recurrence revision receives structured schedule fields for weekly day sets, monthly day or ordinal-weekday patterns, end conditions, reminder inheritance, and Deadline-relative Start offsets. Existing simple daily, weekly, monthly, and yearly rules remain valid defaults.

Saving Repeat on an ordinary task snapshots that task as the recurrence template and adopts the existing task as the first occurrence rather than creating a duplicate. The adopted occurrence records explicit provenance while generated occurrences continue to reference template instantiations. Editing a recurrence creates a new revision that affects only future ungenerated occurrences.

Alternative considered: create the recurrence and immediately generate a second task. Rejected because it duplicates the task the user just configured and makes completion semantics surprising.

### Use one schedule anchor

For calendar recurrence without deadlines, the schedule date is the generated task's Start. With deadlines enabled, the schedule date is the Deadline and Start is the configured number of days earlier. A configured reminder is attached to the generated Start date. After-completion recurrence computes the next schedule anchor from the authoritative completion date plus its interval, then applies the same Deadline/Start rule.

This mirrors the supplied Things interaction while preserving BathOS's exclusive Start and Today-horizon invariants.

### Bound recurrence generation and previews

The client preview is pure and bounded. Authoritative evaluation remains server-owned and idempotent. Upcoming requests evaluation through a rolling one-year horizon, while the existing cursor and catch-up limit prevent rescanning old recurrence history. End-on dates are inclusive, and end-after counts include the adopted/current occurrence.

Alternative considered: generate an unlimited future series. Rejected because it creates unbounded storage, synchronization, and list costs.

### Represent waiting after-completion definitions without speculative successors

An active after-completion definition with an outstanding occurrence appears once in a non-draggable `Repeating Tasks` section at the bottom of Upcoming. The next occurrence is not generated until the current occurrence is completed. Calendar occurrences continue to appear in their ordinary date buckets.

### Retain terminal tasks as normal editable records

Done will use the same task drawer, focus, selection, and metadata editing surfaces as active views. Terminal-state guards will permit content, planning, organization, actionability, Deadline, checklist, and recurrence edits while prohibiting an edit from implicitly reopening the task. Reopen or restore clears only the relevant terminal state and routes the task according to its current metadata.

Done groups records by the owner-local date of `completed_at`, `canceled_at`, or `deleted_at`. It never exposes drag reordering.

Alternative considered: edit a temporary restoration copy. Rejected because the user explicitly wants retained terminal tasks to remain first-class records.

### Make deletion a guarded terminal transition

Ellipsis Delete, open-task Command+Delete, focused-task Delete or Command+Delete, and selected-task Delete invoke the same hierarchy-safe deletion path. Bulk deletion applies that guarded transition to every selected task, rejects duplicate terminal actions, and keeps each task mutation independently recoverable through history. Plain Delete in an open text-editing context remains native and never deletes the task.

### Reverse Return submission with explicit field ownership

The global form interaction layer will submit the nearest ordinary form when unmodified Return occurs in a single-line input outside composition. Textareas retain newline behavior. A field or composite with `data-bathos-field-return-owned="true"` keeps Return for its own menu, picker, parsing, or staged-confirmation behavior. Command+Return remains the explicit form-level submit command. An exceptional form may opt out with `data-bathos-return-submits="false"`.

Alternative considered: remove the shared handler and rely exclusively on browser implicit submission. Rejected because modal scopes, portaled controls, validation-aware actions, and consistent field ownership require one shared contract.

## Risks / Trade-offs

- [Recurrence date arithmetic across DST and time zones] → Keep recurrence anchors as owner-local dates, resolve reminder instants with existing time-zone utilities, and test DST boundaries.
- [Large recurrence series impacts synchronization] → Evaluate only through a rolling one-year horizon and retain existing cursor, catch-up limits, and deterministic uniqueness.
- [Checklist completion reordering conflicts across devices] → Assign order keys transactionally, preserve mutation identifiers, and exercise multi-client convergence tests.
- [Terminal editing could accidentally reopen tasks] → Separate editable-field validation from explicit reopen/restore transitions and test every terminal disposition.
- [Global Return behavior submits an unintended form] → Require a single-line input, ignore composition, honor field ownership and explicit opt-out, and run shared interaction tests across module families.
- [Native drag cancellation varies by browser] → Preserve native HTML drag behavior, Escape cancellation where the browser delivers it, and no custom pointer layer.
- [The overnight implementation cannot safely mutate production without approval] → Complete local implementation and validation, then provide one exact production approval prompt.

## Migration Plan

1. Create and validate the OpenSpec change.
2. Add a forward-only Supabase migration that enriches recurrence revisions and RPCs, supports adopting an existing task, preserves old recurrence rows, and allows guarded terminal metadata edits.
3. Update generated Supabase types, PowerSync parsing/upload behavior, database tests, and portability.
4. Implement shared Return behavior and Tasks UI/domain behavior behind the migrated contract.
5. Run database tests, application tests, TypeScript, lint, production build, strict OpenSpec validation, and rendered desktop/mobile acceptance.
6. Before production mutation, refresh and verify the private Tasks backup and repeat the exact preflight.
7. Apply the migration, publish the matching web release, run disposable owner-scoped fixtures, and verify PowerSync remains exactly 20 tables, cron, advisors, parity, and rendered behavior.
8. Roll back the web release first if required. The additive recurrence columns remain backward compatible. A database rollback must restore the verified private backup because adopted recurrence provenance and terminal edits may have been accepted after deployment.

## Open Questions

No question blocks local implementation. The following assumptions will be reported for post-hoc review:

- Recurrence edits snapshot the source task for future occurrences when Repeat is saved; later edits to one generated occurrence do not silently revise the template.
- `Repeating Tasks` is the BathOS label, despite the supplied Things screenshot using “Repeating To-Dos.”
- A rolling one-year Upcoming generation horizon is sufficient for the initial release.
- Checklist undo and recurrence editing participate in the durable task history rather than a component-only history.
- Checklist placement in the metadata drawer is immediately after Notes and before Primary Link.
- The first rich recurrence release creates Repeat from a task. Revising an existing rich rule in the same task drawer remains a follow-up decision because the existing Templates recurrence editor only exposes the older rule surface.
