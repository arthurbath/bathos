## Why

Bulk selection currently persists when the user moves their attention away from the task list, and selecting every visible to-do requires first entering selection mode. The interaction should treat selection as a temporary list context and make the standard select-all gesture work directly from the Tasks view.

## What Changes

- Exit bulk selection whenever the user clicks or taps outside a to-do row.
- Make Command+A on Mac and Control+A on Windows select every visible to-do in Today, Upcoming, Anytime, or Someday, whether or not selection is already active.
- Preserve native select-all behavior when an editable text control owns the keyboard event.
- Keep clicks within any to-do row available to the row's existing opening, selection, completion, and action interactions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refines bulk-selection dismissal and select-all keyboard behavior.

## Impact

- **Tasks UI:** `TasksShell` list-level pointer and keyboard event handling, task-row identification, and bulk-selection state.
- **Tests and specification:** Focused shell interaction tests and the durable personal Tasks behavior contract.
- **Unchanged systems:** No Supabase, PowerSync, MCP, dependency, shared-component, or other BathOS module changes.
