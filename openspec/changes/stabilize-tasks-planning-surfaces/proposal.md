## Why

Tasks currently presents several planning surfaces with inconsistent identity, ordering, focus, and native-container behavior. The result is avoidable visual instability in Quick Find and open editors, non-authoritative Upcoming/widget ordering, stale PowerSync warnings, and native iOS gestures that conflict with task interaction.

## What Changes

- Give Upcoming a dedicated, owner-controlled rank for ordinary tasks and recurrence prototypes within each visible date bucket, and use that rank for drag/drop, midnight Inbox activation, and web/native widget projections.
- Refine Quick Find placement, backdrop, empty state, labels, whole-row focus, routing, and destination scrolling.
- Render an open task's Summary input directly in its summary row and align opened/search-target tasks with one collapsed-row gap above them.
- Render the current-day star whenever Today is visible in a shared calendar, including adjacent-month overflow cells.
- Restore native-feeling iOS scrolling without displacing fixed controls or weakening task drag behavior, and disable native web-view back/forward swipe navigation.
- Remove retired Template tables from the active PowerSync rule surface and verify the approved Tasks publication remains exactly 17 tables.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Upcoming ordering, Quick Find presentation and navigation, open-task summary composition, destination alignment, and touch/native interaction behavior.
- `shared-date-picker-indicators`: Current-day star rendering in adjacent-month overflow cells.
- `tasks-ios-companion`: Native scrolling, disabled web-view history swipes, and authoritative Upcoming widget ordering.
- `tasks-macos-companion`: Authoritative Upcoming widget ordering shared with the web and iOS projections.

## Impact

This changes the Tasks React module, shared Calendar behavior, iOS and macOS companion web views, native widget snapshot projection, Tasks database schema/RPCs, PowerSync schema and rules, Supabase-generated types, tests, and production deployment. The migration adds ordering columns but no tables, rewrites only rank metadata, and keeps PowerSync at exactly 17 approved Tasks tables.
