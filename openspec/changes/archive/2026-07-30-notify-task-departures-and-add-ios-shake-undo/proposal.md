## Why

Task metadata edits can make a to-do disappear from the current list or quick-filter result without consistently explaining where it went. The iOS companion also lacks the familiar physical shake gesture for invoking the task history that already powers keyboard undo.

## What Changes

- Detect successful metadata mutations that cause one or more visible to-dos to leave the current list or stop matching the active quick filter.
- Show one neutral, informative toast that distinguishes a list move from quick-filter exclusion and identifies the destination or active filter when practical.
- Defer the notice for an open editor until the to-do closes and actually leaves the rendered list.
- Translate an iOS shake gesture into the existing web task undo command without introducing a second native undo history.
- Preserve the existing neutral Nothing to Undo behavior when no task or checklist change can be safely reversed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Metadata changes consistently explain why affected to-dos leave the current view, including quick-filter exclusion and list movement.
- `tasks-ios-companion`: A physical shake in the foreground iOS companion invokes the existing Tasks undo command.

## Impact

The change affects the Tasks list mutation hook, task-shell feedback and command handling, focused web tests, the iOS `WKWebView` host, and native companion tests. It adds no database objects, migrations, external dependencies, service authority, or macOS shake behavior.
