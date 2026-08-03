## Context

The iOS Control Center action already opens `TaskNativeRoute.newTask`, which maps to the bounded `native_new_task=1` web signal and explicitly creates a Today Inbox draft. The shared iOS/macOS large-widget header instead always opens `TaskNativeRoute.newTaskInList`, whose `native_new_task=list` signal intentionally reuses the current list's ordinary floating-add placement. On Today, ordinary placement can select the first visible horizon rather than Inbox.

## Goals / Non-Goals

**Goals:**

- Make the Today widget plus action create in Today Inbox on both Apple platforms.
- Keep the Control Center action aligned with that same explicit route.
- Preserve existing list-aware creation for Upcoming, Anytime, and Someday widgets.

**Non-Goals:**

- Change the in-app floating add button or bucket-heading creation behavior.
- Add a new deep-link syntax, query parameter, task mutation path, or database field.
- Rebuild or install native applications in this change unless separately requested.

## Decisions

The shared `largeWidgetNewTaskURL(for:)` policy will return `TaskNativeRoute.newTask` for `.today` and retain `TaskNativeRoute.newTaskInList(listID)` for every other configurable list. This reuses the already allowlisted, tested Control Center route instead of adding a second Inbox-specific URL representation.

The web module remains unchanged. It already treats `native_new_task=1` as explicit Today Inbox placement and `native_new_task=list` as current-list placement. Keeping the distinction at the native route producer makes the desired intent explicit before the app opens.

## Risks / Trade-offs

- [Risk] A broad route change could make every widget ignore its configured list. -> Branch only on `.today` and assert the routes for all configurable lists.
- [Risk] Future Control Center work could drift from the widget behavior. -> Assert that the Today widget URL is the same canonical `.newTask` route used by Control Center.
- [Trade-off] The Today widget plus no longer mirrors the in-app floating button's first-visible-horizon placement. -> This is intentional because native quick capture is specified as Inbox triage.
