## Context

The expanded task editor owns local controlled values so direct edits render immediately while autosave is pending. Keyboard commands such as Control+G mutate the task through the parent task list instead of the editor control, so the editor's local Actionability value can remain stale after the task prop changes.

Actionability and Organization use portaled Radix Select content. When an open select is dismissed by clicking its trigger or label, Radix can retarget the dismissing pointer through its outside-interaction layer. The Tasks document-level outside-pointer listener can therefore interpret the same pointer as being outside the task and close the complete editor.

## Goals / Non-Goals

**Goals:**

- Keep controlled identity fields synchronized with accepted task-prop changes.
- Give an open editor-owned select exclusive ownership of the pointer interaction that dismisses it.
- Preserve ordinary outside-click closure when no nested select is open.

**Non-Goals:**

- Change the shared BathOS Select component for unrelated modules.
- Change keyboard command mappings or task mutation semantics.
- Alter autosave queues, persistence formats, or synchronization behavior.

## Decisions

TaskEditor will reconcile Actionability and Organization local state from the corresponding task props when those props change. Dependencies will be limited to the accepted source fields so unrelated task rerenders do not disturb local editing.

The Tasks outside-pointer boundary will detect an open listbox owned by the expanded task editor before attempting to close the editor. That pointer is reserved for dismissing the nested select. A following pointer interaction, after the listbox is closed, retains the existing outside-click behavior.

Editor-owned SelectContent instances will carry an explicit data attribute. This avoids treating unrelated listboxes elsewhere on the page as part of the selected task's interaction boundary.

## Risks / Trade-offs

- [Risk] Prop reconciliation could overwrite an optimistic local select value before persistence returns. → Mitigation: Effects depend only on source prop changes, while direct select changes still update local state immediately.
- [Risk] The first pointer outside an open select no longer closes both layers at once. → Mitigation: This is intentional nested-layer behavior and prevents accidental loss of the task editing context.
