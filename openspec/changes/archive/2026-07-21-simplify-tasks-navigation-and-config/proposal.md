## Why

Tasks uses BathOS's visual primitives, but its current hierarchy exposes nine peer destinations, persistent maintenance controls, and reminder capability on daily planning views. The result is crowded on desktop, exceeds the five-tab mobile limit, and gives configuration and diagnostics more prominence than everyday task work.

## What Changes

- Reduce persistent Tasks navigation to Inbox, Today, Upcoming, Anytime, and More
- Put Someday, Projects, Templates, Logbook, Trash, and Config inside the More menu on desktop and mobile
- Add a dedicated Config route for browser reminders, synchronization diagnostics, and backup/restore
- Remove backup/restore, synchronization status, reminder capability, Projects, and Templates shortcuts from daily-view headers
- Name every page heading after the active view instead of repeating the generic module name on desktop
- Replace permanent area and project creation fields with compact add buttons and BathOS modal forms
- Preserve real-link behavior, keyboard navigation commands, route-runtime stability, and all existing task-domain behavior

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define a five-destination primary navigation hierarchy, a Config-owned maintenance surface, concise daily views, modal hierarchy creation, and responsive accessibility behavior

## Impact

- Tasks module: `TasksShell`, route registration, Projects presentation, Config presentation, diagnostics, reminder settings, backup/restore, and focused tests
- Shared platform: Backward-compatible overflow-menu support for `MobileBottomNav`
- Supabase and PowerSync: No schema, policy, function, publication, credential, or synchronization-contract change
- Other BathOS modules: Existing mobile navigation behavior remains unchanged unless they opt into overflow items
