## Why

Global Quick Entry currently withholds an already-created warm panel until the refreshed web editor reports readiness, leaving no visible acknowledgement for up to the full compatibility timeout after the user presses the global shortcut. The panel's declared drag surface also does not reliably initiate AppKit window movement.

## What Changes

- Present the native Quick Entry panel synchronously for every shortcut invocation, with its existing native loading state visible until the fresh editor is ready.
- Keep stale or intermediate web content hidden while the immediate native loading surface is visible.
- Make the dedicated top drag region explicitly initiate native panel dragging instead of relying only on background-movement inference.
- Add native regression coverage for immediate presentation and the drag-region contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Strengthen Global Quick Entry so every cold or warm invocation produces immediate visible feedback and its top drag region reliably moves the panel.

## Impact

- macOS Tasks companion Quick Entry window lifecycle and AppKit drag handling.
- macOS companion regression tests.
- No database, Supabase, web API, or cross-module changes.
