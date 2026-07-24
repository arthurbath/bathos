## Why

BathOS currently mixes native browser form behavior, module-specific keyboard handlers, and partial shared shortcuts, which makes the same control behave differently across dialogs, pages, DataGrids, and Tasks. A single interaction contract is needed so keyboard users can predict field-level commit/cancel behavior, form-level submit/cancel behavior, and spreadsheet-style DataGrid navigation without imposing an unnecessary view/edit split on ordinary forms.

## What Changes

- **BREAKING** Standardize field-level Space, Return, Escape, Delete, Backspace, arrow, Tab, and Shift+Tab behavior across ordinary forms and DataGrids.
- Keep ordinary text-entry controls continuously editable while retaining separate focused and editing states for text-entry cells inside DataGrids.
- Add shared form-level Command+Return submission and Command+Escape cancellation on Mac, with Control+Return and Control+Shift+X equivalents on Windows.
- Make Return-to-submit an explicit per-form opt-in and enable it for every gateway authentication form.
- Preserve native button, link, checkbox, select, date-picker, file-input, color-control, and text-entry semantics where the BathOS contract does not deliberately override them.
- Make DataGrid Tab traversal commit and move across rows, exit at grid boundaries, keep arrow navigation spatial outside editing, and keep text arrows inside the active editor.
- Require safe, explicitly declared reset targets for Delete and Backspace.
- Make date pickers arrow-navigable but exclude their internal controls from the containing form's Tab sequence.
- **BREAKING** Replace plain Escape task-editor closure with form-level Command+Escape on Mac and Control+Shift+X on Windows while retaining field-level Escape for nested task controls.
- Update shared documentation, interaction references, and focused regression coverage for modal, page, gateway, DataGrid, Tasks, file, color, and date-picker surfaces.

## Capabilities

### New Capabilities

- `form-control-interactions`: Shared field-level, form-level, modal, page-form, DataGrid, composite-control, reset, traversal, validation, and platform-shortcut behavior throughout BathOS.

### Modified Capabilities

- `personal-tasks-module`: Task editors and Task date pickers adopt the shared form submit/cancel and Tab-boundary contract.

## Impact

- Shared platform and UI code under `src/platform/` and `src/components/ui/`, including form shortcuts, dialogs, alert dialogs, sheets, selects, date pickers, calendars, DataGrid primitives, file inputs, and color controls.
- Gateway authentication, password recovery, household setup, account, feedback, administration, confirmation, and module-specific form surfaces.
- Tasks editor commands, Tasks date-picker traversal, Tasks keyboard help, and durable Tasks interaction requirements.
- Existing DataGrid modules, including Budget, Drawers, Garage, Snake, Wardrobe, and shared configuration views.
- No database, Supabase, PowerSync, Edge Function, or external API changes.
