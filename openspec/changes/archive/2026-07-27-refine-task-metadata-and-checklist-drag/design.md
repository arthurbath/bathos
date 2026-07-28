## Context

Checklist handles are nested inside draggable task rows. Native drag events bubble, so a checklist handle currently starts both the checklist drag state and the enclosing task-row drag state. Task horizon commands currently calculate a separate next value for every target, while the requested bulk behavior requires one shared target. Collapsed metadata and the editor are rendered in `TasksShell.tsx`.

## Goals / Non-Goals

**Goals:**

- Give checklist and task-list drags mutually exclusive ownership.
- Derive one deterministic horizon target for every command invocation.
- Establish one canonical collapsed metadata order and presentation.
- Make optional Primary Link disclosure match the existing checklist disclosure pattern.

**Non-Goals:**

- No custom pointer drag system or custom autoscrolling.
- No schema, synchronization, reminder, recurrence, or MCP changes.
- No new task metadata fields.

## Decisions

1. Checklist handles stop native drag-start propagation after writing the checklist MIME type. Checklist-owned drag-over and drop handlers also stop propagation. This preserves native drag behavior and last-valid document drop finalization while preventing the enclosing task row from acquiring source identity.
2. The horizon command derives the current effective non-Inbox horizon for all targets. It advances only when every target already shares Now, Next, or Later. Mixed, Inbox, unplanned, Someday, and future-start selections normalize to Today Now.
3. The row renderer owns canonical metadata order. The horizon marker moves from the Summary line into the metadata line and is provided only for Anytime.
4. `TaskEditorForm` retains local disclosure state for Primary Link. Existing nonempty links reveal the URL field immediately. Missing links show an Add Primary Link action that reveals and focuses the field without persisting a value until the user types.

## Risks / Trade-offs

- [Risk] Stopping nested drag propagation could prevent outside-document finalization. → Document-capture finalization remains active, and focused tests cover local and outside-checklist drops.
- [Risk] Existing tests may encode the older Upcoming horizon marker or desktop actionability text. → Update focused presentation tests to assert the new canonical contract.
- [Risk] Focusing the newly revealed link input before React commits it could fail. → Request focus in a layout effect keyed to disclosure state.
