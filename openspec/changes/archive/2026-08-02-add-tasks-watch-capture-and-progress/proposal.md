## Why

Apple Watch is a valuable low-friction capture surface, but the current Tasks companions provide no watchOS experience. A deliberately narrow companion can make Inbox capture immediate and provide a glanceable Today-completion signal without reproducing task management on the watch.

## What Changes

- Add a watchOS companion whose sole task workflow is creating a new Today Inbox task through the system text-entry interface.
- Add one circular WidgetKit complication that shows completed, non-deleted tasks whose Start is today as a proportion of all non-deleted tasks whose Start is today.
- Refresh the complication when the watch app opens and through conservative system-budgeted background timelines.
- Transfer the existing owner-bound native widget credential from the paired iPhone companion to the watch instead of introducing a watch login or general database session.
- Extend the narrow native Edge Function authority with only Inbox creation and aggregate Today-progress operations.
- Use the Apple Watch variant of the shared Tasks Apple native icon for the watch app and a simple checkmark inside the progress complication, with no task-list browsing or task-management surface.

## Capabilities

### New Capabilities

- `tasks-watch-companion`: Covers watchOS installation, secure companion authority, system text capture, complication progress semantics, refresh, privacy, and reproducible builds.

### Modified Capabilities

- `tasks-ios-companion`: Transfers the current owner-bound native credential to the paired watch and clears or replaces watch authority as the signed-in owner changes.

## Impact

- Adds watchOS app and WidgetKit extension targets to `ios/TasksCompanion` while preserving the existing iOS app and widgets.
- Adds shared WatchConnectivity and native-action models used by the iPhone and watch targets.
- Adds service-role-only Tasks RPCs and two validated actions to `tasks-widget-actions`; no new replicated table or general-purpose mutation authority is introduced.
- Requires watchOS signing, paired-device installation, and physical-watch acceptance testing after local simulator/build verification.
