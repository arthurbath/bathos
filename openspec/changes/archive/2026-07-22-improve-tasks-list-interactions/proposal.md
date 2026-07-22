## Why

Tasks currently exposes header controls for one-step undo and selection even though both interactions are more efficient as direct keyboard and pointer behaviors. The list also supports only incremental menu or keyboard reordering, which makes longer manual-order changes unnecessarily laborious.

## What Changes

- Remove the visible Undo and selection-mode buttons from the Tasks header while preserving accessible, discoverable interaction paths.
- Replace one-step task undo with a bounded 100-entry task-mutation history, add redo, and keep native text-field undo and redo untouched.
- Enter and operate bulk selection directly from task rows with platform-appropriate modifier-click and anchored Shift-click range selection while retaining ordinary single-click task expansion outside selection mode.
- Add direct drag-and-drop reordering within each manually ordered task scope while retaining the existing accessible keyboard and menu alternatives.
- Revise the Keyboard Commands panel to document keyboard, pointer-selection, and drag interactions in simultaneous Mac and Windows columns, with the current platform identified when detectable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Changes the Tasks module's recoverable-history, bulk-selection, manual-ordering, and keyboard-discoverability contracts.

## Impact

- **Tasks UI:** `TasksShell`, task rows, selection state, keyboard event handling, and the Keyboard Commands panel.
- **Tasks data layer:** History projection and repository inverse-mutation behavior, bounded client undo and redo stacks, and arbitrary-position order-key generation.
- **Supabase:** A Tasks migration will extend history-trigger validation to distinguish guarded undo from guarded redo without weakening owner or snapshot checks. The matching history schema and production deployment require normal approval and verification.
- **Tests and documentation:** Tasks domain, hook, repository, shell, migration, and durable OpenSpec coverage will be updated. Other BathOS modules and shared platform components are unaffected.
