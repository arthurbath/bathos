## Why

Tasks Settings currently mixes the established BathOS card pattern with icon-prefixed utility rows, hides useful synchronization state behind a diagnostic modal, and exposes backup controls that users should not need to maintain. The page should prioritize everyday feature controls and concise sync confidence while reserving debug-only evidence for logs.

## What Changes

- Reorder Tasks Settings into Features, Areas, Sync Status, and the existing installed-app Account card.
- Consolidate browser Notifications, automatic list sorting, native macOS Global Quick Entry, and point-and-click Keyboard Shortcuts access into one headed Features card with consistent setting rows.
- Replace the synchronization-details modal with an inline Sync Status summary limited to health, pending changes, and the last successful sync.
- Remove Task Backup and Restore from the frontend while retaining its backend services.
- Make the macOS shortcut recorder compact, clearable, and able to commit the currently configured shortcut again.
- Simplify the Keyboard Shortcuts dialog to show only the shortcut column relevant to the current platform and remove redundant table headings.
- Record native notification configuration as a future surface-specific capability without implementing native notifications in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Redesign the Config route, browser notification control, synchronization summary, and frontend maintenance surfaces.
- `tasks-macos-companion`: Present Global Quick Entry as a clearable feature setting instead of a standalone card and accept re-entry of the current shortcut.

## Impact

- Tasks settings composition and focused component tests in `src/modules/tasks/`.
- Existing browser Web Push and PowerSync diagnostic hooks remain authoritative.
- Existing task portability services, APIs, and native notification implementation remain unchanged.
