## Why

Several Tasks interactions currently lose important affordances or immediate feedback: an open task has no dependable drag handle, modified-click selection can accidentally retain a different focused task, undo and redo appear unresponsive while history is reconciled, and native capture surfaces have avoidable layout and lifecycle friction. BathOS also needs one durable non-grid input-outline convention so ordinary forms retain visible but subordinate borders throughout the platform.

## What Changes

- Restore the open task summary row as the task-level drag handle while keeping Summary editing in the expanded metadata drawer.
- Make Command-click and Shift-click begin selection mode with only the clicked task, close any different open task, and clear the prior lightweight keyboard focus; retain Control+B as the explicit way to begin selection with the current task.
- Standardize ordinary non-DataGrid inputs on one solid muted-gray outline, leaving the brighter focus treatment clearly distinguishable and preserving the DataGrid border-on-focus exception.
- Show an immediate blocking spinner overlay while a requested task undo or redo is being resolved.
- Permit landscape orientation in the iOS companion and hide persistent mobile navigation while the software keyboard is visible.
- Refine the macOS global quick-entry window to fit the compact Start picker with balanced padding, protect input focus outlines from clipping, show loading progress without content flashes, toggle closed from the global shortcut, and treat dismissal as cancellation while explicit submission commits the task.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Open-row editing and drag affordances, modified-click selection entry, undo/redo progress feedback, and keyboard-sensitive mobile navigation change.
- `platform-visual-foundations`: Ordinary non-grid form controls adopt the shared solid muted-gray outline convention.
- `form-control-interactions`: Focus treatment remains visually stronger than the persistent ordinary-input outline while DataGrid controls retain their specialized border behavior.
- `tasks-ios-companion`: The installed app permits landscape orientation and cooperates with the web module's software-keyboard navigation suppression.
- `tasks-macos-companion`: Global quick entry gains compact stable presentation, loading feedback, toggle dismissal, and explicit commit/cancel semantics.

## Impact

- Tasks React surfaces and tests under `src/modules/tasks/`, shared input primitives and theme tokens under `src/components/ui/` and `src/index.css`, and native-shell detection under `src/platform/`.
- iOS companion orientation metadata and keyboard viewport behavior under `ios/TasksCompanion/`.
- macOS companion quick-entry panel, web-view bridge, and tests under `macos/TasksCompanion/`.
- No database schema, PowerSync topology, RLS policy, or public API changes are expected.
