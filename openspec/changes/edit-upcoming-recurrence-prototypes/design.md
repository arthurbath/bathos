## Context

The current recurrence projection stores ordinary inherited content in the current immutable recurrence revision, but Upcoming renders only the prototype title and an occasional checklist glyph. Activating a prototype opens `TaskRepeatDialog`, which currently edits both that inherited content and the cadence in one atomic form.

Ordinary task drawers already establish the desired interaction: text fields autosave after a short delay, discrete controls save immediately, and checklist edits remain part of the opened item. Recurrence edits must still create immutable revisions through the existing recurrence RPC and must not create task rows.

## Goals / Non-Goals

**Goals:**

- Give dated and waiting recurrence prototypes the same useful summary metadata as ordinary task rows.
- Provide an inline prototype drawer for ordinary inherited content.
- Keep recurrence cadence changes atomic in a smaller Edit Repeat modal.
- Preserve recurrence revision integrity and optimistic UI behavior.

**Non-Goals:**

- Make prototypes completable, bulk-selectable, or ordinary task rows.
- Let the drawer edit generated Start, Deadline, reminder, or cadence rules.
- Change already generated task instances when a prototype is edited.
- Change the recurrence database schema or RPC contract.

## Decisions

1. **Project recurrence content through a prototype-specific drawer.** The drawer reuses the ordinary task editor's visual and keyboard conventions but edits the revision's embedded prototype snapshot and target Area. A dedicated editor is preferable to fabricating a task row because prototype checklists are revision JSON rather than task-checklist table rows.

2. **Serialize prototype autosaves through the existing recurrence edit mutation.** Each edit preserves the current cadence fields, writes a complete patched prototype snapshot, and uses the accepted result as the base for the next queued edit. This prevents record-revision conflicts during rapid typing without adding a new RPC.

3. **Derive prototype deadline presentation from recurrence scheduling.** When the current recurrence revision enables deadlines, `next_occurrence_date` is the Deadline for the next generated instance while the Upcoming bucket date is its derived Start. Waiting after-completion prototypes have no knowable next Deadline and omit it.

4. **Keep Edit Repeat cadence-only.** Editing an existing recurrence hides Summary, Notes, Primary Link, Area, Actionability, and Checklist fields. Saving the form passes through the current prototype snapshot and Area unchanged while creating the normal immutable cadence revision.

5. **Open the drawer from the prototype summary and retain Edit Repeat in explicit actions.** The leading recurrence symbol remains non-completable, the ellipsis retains Edit Repeat, and waiting prototypes retain Go to Instance.

6. **Use one mixed Upcoming row order for rendering and drag targeting.** Ordinary tasks and dated recurrence prototypes in a date section share the same total order of fractional key plus stable row identity. Row drops and section-edge drops derive their targets from that same mixed sequence so the displayed insertion position and persisted position cannot disagree.

7. **Retry orthogonal prototype-rank conflicts against the authoritative definition.** Prototype metadata autosaves and recurrence evaluation advance the recurrence record revision even when they do not invalidate a manual Upcoming rank. A reorder that receives a conflict retries once against the returned authoritative definition while retaining the optimistic position, and only rolls back if the retry also fails.

8. **Treat the ordinary-task Upcoming rank as a synchronized mutable field.** `tasks_todos.upcoming_order_key` participates in the same durable PowerSync upload contract as `order_key`. Task inserts preserve an explicit Upcoming rank and task updates may upload a changed Upcoming rank. Rejecting that column as unknown creates a misleading optimistic reorder followed by an authoritative snap-back, so connector coverage exercises the real CRUD parser rather than only the task-list hook.

## Risks / Trade-offs

- **[Rapid autosaves could conflict on immutable revisions]** -> Queue mutations per opened prototype and advance the local definition/revision base after every accepted response.
- **[Prototype UI could drift from ordinary task UI]** -> Reuse the same primitives, iconography, metadata ordering, and autosave timings, with focused tests for the intentionally omitted temporal controls.
- **[A cadence save could overwrite a concurrent drawer edit]** -> The drawer flushes before invoking Edit Repeat, and the modal receives the latest accepted definition and revision.
- **[The next-instance Deadline can be misunderstood as a prototype-owned task date]** -> Render it only as summary projection; keep Deadline absent from the ordinary metadata editor and editable only through repeat settings.
- **[A recurrence revision can change while its prototype is being dragged]** -> Treat Upcoming rank as an orthogonal last-intent mutation and retry once with the authoritative definition returned by the conflict response.
- **[Mixed rows can expose a placement the persistence layer cannot address]** -> Share one stable mixed-row projection across rendering, direct row targets, bucket-edge targets, and fractional-key generation.
- **[A local ordinary-task reorder can snap back after upload]** -> Admit `upcoming_order_key` through the task insert and update CRUD parsers and verify the synchronized browser flow through reload.
