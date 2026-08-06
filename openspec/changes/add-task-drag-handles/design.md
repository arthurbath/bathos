## Context

Tasks currently relies on native HTML drag-and-drop from task summary rows and complete checklist rows. On touch browsers, native drag recognition intentionally waits before claiming a gesture, which protects scrolling but makes repeated reordering slow. The iOS companion embeds the same web application in WKWebView, so one web interaction can serve browser, PWA, and native surfaces.

The setting must synchronize across devices, while its Touch Devices Only resolution depends on the current device's pointer capabilities. The immediate path must reuse the existing reorder commits rather than create a second ordering model.

## Goals / Non-Goals

**Goals:**

- Persist a three-state account preference and resolve it per current device.
- Provide visible, accessible task and checklist grip handles in eligible reorder contexts.
- Claim touch scrolling immediately only when a gesture begins on a visible handle.
- Reuse existing drop validation, grouped drag, autosave, persistence, conflict, and undo behavior.
- Preserve the native row-drag path when handles are hidden or not used.

**Non-Goals:**

- Replacing native scrolling or momentum for the list.
- Making currently fixed surfaces reorderable.
- Adding a native Swift reorder implementation.
- Changing order persistence or conflict resolution.

## Decisions

### Persist a constrained string preference

Add `drag_handle_visibility` to `tasks_user_settings` with `hidden`, `always`, and `touch_only` values and a `hidden` default. A constrained string is readable in synchronized data and supports adding future policies without overloading booleans.

Alternative considered: store the preference only in localStorage. This was rejected because Tasks settings are account-scoped and expected to follow the user across surfaces.

### Resolve touch visibility in the client

`touch_only` resolves visible when the browser reports touch points or a coarse primary pointer. The stored value remains device-independent.

Alternative considered: store separate per-device settings. This would complicate settings ownership without improving the requested behavior.

### Use a handle-scoped pointer interaction

The handle uses Pointer Events, pointer capture, and `touch-action: none`. Pointer down starts transient dragging immediately. Pointer movement hit-tests registered task or checklist drop targets and updates the existing insertion indicator. Pointer up invokes the existing commit function. The rest of each row retains its current touch behavior and native scrolling.

The Tasks shell's pull-to-find gesture rejects touch sequences whose initial target is a task or checklist drag handle. This keeps the handle-owned reorder gesture exclusive even when the list is resting at its top boundary, where the downward pull would otherwise begin Quick Find.

Alternative considered: dispatch a synthetic HTML drag event. Browser security and `DataTransfer` restrictions make synthetic native drag unreliable, especially on iOS. Alternative considered: set `touch-action: none` on the whole row. This would steal ordinary list scrolling and is rejected.

### Keep pointer-drop routing local to Tasks

A Tasks-local drop-target registry maps row and section elements to their existing drag-over callbacks. Pointer hit testing selects the nearest registered target in the appropriate scope. Checklist scopes are isolated per parent task so nested drags never activate task-list targets.

The task-list scope also owns coordinate-based fallback resolution. Each movement sample compares the pointer's vertical coordinate with the live geometry of every legal target in the active list or Upcoming bucket. When no row is directly hit, the nearest insertion boundary wins, so whitespace above or below a short list resolves to the first or final legal position rather than leaving a stale indicator behind. The same resolver runs from handle pointer movement and list-level native drag movement so high-velocity drags do not depend on receiving every intermediate row event.

### Reuse existing reorder transactions

The immediate handle path initializes the same active drag subjects and finishes through the same task or checklist commit code used by native drag. This preserves grouped order, legal section rules, optimistic presentation, history, and rollback.

### Keep trailing task controls stable and compact

The ellipsis action remains mounted when a task drawer opens. When a drag handle is visible, the ellipsis and handle share one compact trailing-control group so opening the task does not remove an established action or create an exaggerated gap between adjacent controls. Recurrence prototypes use the same control-group rhythm.

### Style the source task as one dragged unit

The active drag state is applied to the complete summary-row container rather than only its textual content. This gives the checkbox, metadata, Primary Link action, ellipsis, and handle the same reduced opacity while keeping the drawer, surrounding list, drag preview, and insertion indicator outside that treatment.

## Risks / Trade-offs

- [Pointer capture makes `event.target` remain the handle] -> Resolve drop location with `document.elementsFromPoint` and a scoped target registry.
- [Suppressing touch action can block scrolling] -> Apply `touch-action: none` only to the small handle, never to the row or list.
- [A finger can outrun a static viewport] -> Auto-scroll near the viewport edges while continuously re-evaluating the drop target.
- [Sparse lists and fast movement can miss row drag-over events] -> Resolve every movement sample against live target geometry and fall back to the nearest legal insertion boundary across the list surface.
- [Two drag paths can diverge] -> Share active-drag setup and final commit functions and cover both paths with regression tests.
- [Older synchronized clients do not know the new column] -> Use a defaulted additive column and keep all existing settings columns compatible.

## Migration Plan

1. Add the defaulted, constrained settings column.
2. Update generated Supabase types, PowerSync schema, repository reads/writes, and settings UI.
3. Deploy the web implementation. Existing clients read Hidden until the user changes the setting.
4. Rebuild native companions only when a matching web/native release is requested. No Swift change is required.

Rollback removes the handle UI and ignores the additive column. The column can remain safely if application rollback precedes database cleanup.

## Open Questions

None.
