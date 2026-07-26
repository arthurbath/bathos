## Why

Task creation is currently presented as a small header action and always renders a draft above the list, which disconnects capture from the planning context the user is viewing. Tasks needs a prominent touch-friendly creation action and contextual bucket actions that place new work exactly where the user invoked creation.

## What Changes

- Replace the task-list header add action with a large fixed circular add button at the bottom-right of active planning lists.
- Resolve generic creation to the first visible task bucket and inherit that bucket's planning criteria.
- Make Today and Upcoming bucket headings create tasks in their represented horizon or date grouping, with a small Lucide Plus affordance revealed on hover or keyboard focus.
- Render the open creation draft inside its resolved bucket at the top of that bucket instead of in a detached global section.
- Preserve the existing keyboard new-task command and its established planning defaults.
- Keep Done and non-planning surfaces free of the floating and bucket-scoped creation affordances.
- Restore a small fixed inset above the task editor Title while keeping the disclosure animation single-stage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Task capture gains floating and bucket-scoped entry points, contextual planning defaults, in-bucket draft placement, and a refined editor inset.

## Impact

- **Module:** Tasks only.
- **Code:** `TasksShell`, task creation draft domain helpers, Upcoming grouping helpers, and focused component/domain tests.
- **UI:** Task list headers, Today and Upcoming section headings, task draft placement, floating mobile/desktop action placement, and editor spacing.
- **Data/API:** No schema, Supabase, PowerSync, MCP, or dependency changes.
