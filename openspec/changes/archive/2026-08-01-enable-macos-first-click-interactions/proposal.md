## Why

The native macOS Tasks window currently consumes the first pointer press only to activate the application, forcing the user to repeat clicks and drag gestures. Tasks should behave like a responsive native tool by allowing the same initial press to activate the window and reach the intended web interaction.

## What Changes

- Allow pointer presses over the hosted Tasks web surface to pass through when the native Mac window is inactive.
- Preserve the original pointer sequence so ordinary clicks, text placement, controls, and drag initiation behave exactly as they do in an already-active Tasks window.
- Add native regression coverage for the first-mouse policy and validate the macOS companion build.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Require the native web host to accept the initial pointer press that activates an inactive Tasks window.

## Impact

- Affects the macOS companion's `WKWebView` host and its native tests.
- Does not change the Tasks web module, task data, database, APIs, iOS companion, or widget behavior.
