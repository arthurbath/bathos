# Tasks Route Runtime Stability

**Date:** 2026 Jul 21  
**Status:** Published and accepted  
**Scope:** Tasks internal routing, PowerSync runtime lifetime, reminder polling lifetime, area-detail registration, and route-scoped DataGrid undo history

## Decision

Supported `/tasks/...` navigation now remains inside one authenticated Tasks runtime. BathOS registers one guarded `/tasks/*` route, matches every supported path exactly, and includes both project-detail and area-detail patterns. Unknown Tasks paths still leave the Tasks subtree and render the normal 404 boundary.

Route-scoped DataGrid undo history now clears its stacks internally when the pathname changes. It no longer uses a React `key` that recreates the provider and every descendant. A reset generation prevents an async undo or redo started on the prior path from repopulating history or restoring focus after navigation.

No database, Supabase, PowerSync, reminder-service, service-worker, or production-data change is part of this decision.

## Production Incident

The production Safari audit began with Today reporting Synced and Browser Reminders On. Navigating to Inbox caused the Tasks runtime to close its local PowerSync database and create a replacement connection. The interface reported Offline, then Connecting, and the due-reminder claim failed until the connection recovered or the page was reloaded.

Source inspection first found sibling Tasks route elements. Commit `e46162d` replaced them with one guarded wildcard route and registered `/tasks/areas/:areaId`. The initial router regression passed because it rendered `AppRoutes` directly.

Production acceptance of that commit reproduced the reconnect. The complete application tree revealed a second remount boundary: `RouteScopedDataGridHistory` keyed `DataGridHistoryProvider` by `location.pathname`, recreating `AppRoutes` and the Tasks runtime on every path change. The regression was corrected to include that wrapper before the second implementation was accepted.

## Implementation

- `TASK_ROUTE_PATHS` is the single exact registry for static, project-detail, and area-detail Tasks routes.
- `/tasks` continues redirecting to `/tasks/today`.
- One `/tasks/*` route renders Tasks only when the shared matcher accepts the current pathname.
- `DataGridHistoryProvider` accepts a reset key and clears undo/redo state without remounting its children.
- Stale async history operations are ignored after a reset generation changes.
- Router lifecycle tests exercise Today, Inbox, project detail, area detail, unknown paths, and the real route-scoped DataGrid wrapper.
- DataGrid regression coverage proves pathname changes still clear prior-view undo history.

## Validation

The final implementation passed:

- 117 enabled test files with 687 passing tests
- 7 opt-in test files with 9 intentionally skipped environment/endurance tests
- 45 focused routing and DataGrid history tests
- Tasks TypeScript validation
- ESLint
- Production Vite build
- Strict OpenSpec validation with 8/8 items valid

The production build retained the existing bundle-size and stale Browserslist-data notices. Neither is caused by this routing correction.

## Production Acceptance

Commit `a116a0c` was pushed to `main` and published through Lovable. Production served entry bundle `index-Bx2uZ3IW.js` and Tasks bundle `TasksIndex-DMwIJZ-C.js`.

Safari verification on 2026 Jul 21 at approximately 2:24 PM PDT showed:

- Today loaded with Task Sync Status Synced and Browser Reminders On
- Plain in-app navigation from Today to Inbox remained Synced and kept Browser Reminders On
- Plain in-app navigation from Inbox to Projects remained Synced and kept Browser Reminders On
- The registered area-detail pattern rendered `Area Not Found` for a nonexistent owner-safe test identifier rather than falling through to 404
- An unregistered `/tasks/unknown-route-acceptance` path rendered the normal 404 boundary
- Returning to Today restored the ordinary Tasks surface with Synced status and Browser Reminders On

No task, hierarchy, reminder, or production database content was created, edited, completed, deleted, or reordered during acceptance.

## Remaining Boundary

This acceptance proves that ordinary supported route changes no longer restart the installed Tasks runtime. It does not establish sustained replacement readiness, create hierarchy content for a full production area-detail data pass, or replace the ongoing parallel-use evidence period.
