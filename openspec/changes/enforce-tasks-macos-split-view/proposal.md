## Why

The native Tasks window must remain eligible for macOS Split View and other two-up full-screen tiling even as SwiftUI reconciles the scene or the window enters and exits full screen. The current implementation relies partly on implicit AppKit behavior and tests only a one-time synthetic-window configuration, which is weaker than the durable product contract.

## What Changes

- Explicitly opt the main Tasks window into full-screen tiling while removing mutually opposed full-screen behaviors.
- Reassert the narrow, resizable tiling policy across the real window lifecycle instead of only during the initial SwiftUI view configuration.
- Extend native tests to cover the explicit tiling behavior, opposed-state cleanup, and repeat application after lifecycle changes.
- Document the verified two-up entry behavior for the installed Mac companion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Strengthen the existing Split View requirement so eligibility persists across window creation and full-screen lifecycle transitions.

## Impact

- Affects the native macOS Tasks window policy, its SwiftUI-to-AppKit configuration bridge, native unit tests, and companion documentation.
- Does not affect the Tasks web application, iOS companion, database, PowerSync, Supabase, or public APIs.
