## Why

The macOS Global Quick Entry panel currently loses native visual polish, dismisses a draft when the user clicks unused space inside the panel, and exposes two consecutive loading indicators during startup. The overlay should feel like one stable native surface whose interior is safe to click and whose editor appears without a redundant reload or loading-state handoff.

## What Changes

- Restore a rounded macOS panel silhouette with a one-pixel lighter dark-gray border and a restrained native window shadow.
- Preserve the established top padding while increasing horizontal padding around the hosted editor.
- Treat clicks on unused space inside Global Quick Entry as ordinary interior clicks that may blur a field but never cancel the draft.
- Keep one native loading presentation visible until the hosted Tasks route reports that its meaningful content is ready, preventing the native-to-web double-spinner sequence.
- Reuse an already loaded Quick Entry web document through same-document navigation so later invocations avoid a full web reload.
- Retain a bounded compatibility fallback when an older deployed web client cannot send the readiness signal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Refine the existing Global Quick Entry panel presentation, interior-click behavior, readiness handoff, and warm-reuse performance contract.

## Impact

- Native macOS panel construction and shared WebKit loading state in `macos/TasksCompanion` and `ios/TasksCompanion/TasksCompanion/TasksBrowserModel.swift`.
- The Tasks native bridge and native Quick Entry rendering in `src/modules/tasks`.
- Focused Swift and React regression tests plus the macOS native build.
- No database, Supabase, authentication, or public API changes.
