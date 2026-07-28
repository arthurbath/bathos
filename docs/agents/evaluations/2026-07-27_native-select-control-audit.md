# Native Select Control Audit

## Scope

This audit records production React source that still declares native `<select>` controls after the Tasks repeat dialog adopted the shared BathOS Select. Test fixtures are excluded. The audit does not authorize replacing these controls as part of the repeat-dialog change.

## Findings

Eight legacy native selects remain, all inside the Tasks module:

| File | Controls | Replacement Priority |
|---|---|---|
| `src/modules/tasks/components/TaskTemplatesView.tsx` | Current Source, Area | Medium. These are ordinary form dropdowns and should use shared Select when Templates is next changed. |
| `src/modules/tasks/components/TaskRecurrencePanel.tsx` | Template, Rule Mode, Frequency, Missed Events, Area | High. This older recurrence-management surface is the largest remaining concentration and visually overlaps the newly standardized Repeat Task dialog. |
| `src/modules/tasks/components/TaskCommandSurfaces.tsx` | Area | Medium. This is an ordinary task-command dropdown, but replacement should preserve its existing focus and immediate-apply command behavior. |

## Exclusions

- `src/components/ui/data-grid.focus.test.tsx` contains a native select only as a test fixture for shared DataGrid focus behavior.
- Radix Select may render an internal hidden native control for browser form compatibility. That implementation detail is part of the shared component and is not a legacy user-facing native select.

## Recommendation

Replace the eight controls piecemeal when their owning surface is next modified, beginning with `TaskRecurrencePanel`. Each replacement should preserve current mutation, focus, Tab, reset, and disabled-state behavior and should be governed by its own OpenSpec delta if the observable interaction changes.
