## Why

Touch users must currently hold a task or checklist row long enough for the browser to distinguish reordering from scrolling, which makes repeated list organization slow. A configurable, explicit drag handle can safely claim an immediate drag gesture while leaving ordinary scrolling available everywhere else.

## What Changes

- Add an account-level Drag Handles setting with Hidden, Always, and Touch Devices Only options, defaulting existing and new accounts to Hidden.
- Show an accessible grip handle after the row ellipsis for eligible to-dos and after the trailing controls for eligible checklist items when the setting resolves to visible on the current device.
- Let mouse, pen, and touch pointers begin task or checklist reordering immediately from the handle, without a long-press delay.
- Restrict scroll suppression to the handle gesture so touches elsewhere retain native vertical scrolling, momentum, and native-app WebView behavior.
- Preserve the existing task and checklist drop rules, grouped selection behavior, autosave boundary, persistence, undo history, and unsupported-surface restrictions.
- Preserve the existing row-based/native drag path independently of handle visibility.
- Resolve handle and native drag movement against the nearest legal insertion position across the whole list surface, including blank space before the first row, after the final row, and between sparse groups.
- Dim the complete summary row of the actively dragged task, including its checkbox, metadata, Primary Link action, ellipsis, and handle, without dimming unrelated rows or the insertion indicator.
- Keep insertion targeting responsive when a pointer or touch moves quickly enough to skip directly over individual row event boundaries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add configurable task and checklist drag handles with immediate pointer reordering and handle-scoped scroll suppression.
- `tasks-ios-companion`: Permit the web-owned handle gesture to claim touch scrolling inside the handle while retaining native scrolling everywhere else.

## Impact

- Tasks settings UI, synchronized user-settings storage, Supabase schema/types, and PowerSync schema.
- Task rows, recurrence prototype rows, checklist rows, and their existing reorder controllers.
- Browser, PWA, and native iOS WKWebView touch interaction behavior.
- Automated interaction, persistence, and regression tests for preference resolution and immediate handle dragging.
