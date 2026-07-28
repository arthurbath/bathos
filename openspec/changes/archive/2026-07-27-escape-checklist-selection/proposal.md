## Why

Checklist multi-selection currently owns Delete, Backspace, and printable-key suppression but does not provide the expected Escape path for abandoning the transient selection. Users should be able to cancel a Command-clicked or Shift-clicked checklist selection without closing or changing the task.

## What Changes

- Let unmodified Escape clear active checklist-item selection.
- Keep the task editor open and preserve checklist content, completion, and order.
- Prevent the Escape event from bubbling into outer task or page interactions while checklist selection owns it.
- Add regression coverage for both additive and range checklist selection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend checklist multi-selection with a field-local Escape cancellation contract.

## Impact

- `src/modules/tasks/components/TaskChecklistEditor.tsx`
- `src/modules/tasks/components/TaskChecklistEditor.test.tsx`
- `openspec/specs/personal-tasks-module/spec.md`
- No data-model, database, Supabase, PowerSync, or persistence impact.
