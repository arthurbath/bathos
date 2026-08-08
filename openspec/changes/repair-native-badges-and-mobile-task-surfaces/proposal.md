## Why

The native Tasks companions contain badge-update code, but existing installations do not expose badge controls in operating-system notification settings and the Settings handoff is perceptibly slow. The newly centered mobile temporal picker and checklist editor also need their final inset-surface and edge-alignment treatments so they read as intentional modal and drawer content.

## What Changes

- Reconcile previously authorized iOS and macOS notification installations with badge authorization so supported operating systems expose badge controls and Tasks can apply the complete Today count.
- Cache native notification authorization state and open an already-authorized app's operating-system notification settings immediately instead of waiting for a fresh status query on each Edit action.
- Keep the checklist editor's existing negative left overflow and add the same negative right overflow so exposed drag handles align symmetrically with the metadata drawer.
- Give centered mobile Start and Deadline pickers the normal inset border and rounded corners, remove excess footer space, and layer the modal backdrop above mobile navigation and selection controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine centered temporal-picker presentation and checklist edge alignment in the task metadata drawer.
- `tasks-ios-companion`: Migrate existing native notification authorization to include badges and make notification-settings handoff immediate after status is known.
- `tasks-macos-companion`: Migrate existing native notification authorization to include Dock badges and make notification-settings handoff immediate after status is known.

## Impact

- Tasks temporal-picker popover and checklist-editor presentation
- iOS and macOS shared native notification coordinator
- Native authorization, badge-setting, Settings deep-link, and regression tests
- No Supabase, PowerSync, task-domain data, API, or database migration changes
