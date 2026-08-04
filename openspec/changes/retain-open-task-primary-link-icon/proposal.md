## Why

Opening a task currently hides its summary-row Primary Link icon because the icon shares a closed-task-only container with the ellipsis menu. The Primary Link remains relevant while editing, so its protocol-derived icon and external action should remain visible in the ordinary summary row.

## What Changes

- Keep a task's Primary Link icon visible and actionable in the summary row while its metadata drawer is open.
- Style the Primary Link field's external-link action with the semantic blue info-outline button treatment.
- Preserve the existing closed-task-only behavior of the ellipsis menu.
- Preserve the existing suppression of task-row trailing controls during bulk selection.
- Add regression coverage for the closed-to-open task transition.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that an open task retains its Primary Link icon and action in the visible summary row.

## Impact

- Tasks module summary-row rendering in `TasksShell` and Primary Link field rendering in `TaskMetadataDrawerFields`.
- Tasks module component tests.
- No database, API, dependency, native-app, or migration impact.
