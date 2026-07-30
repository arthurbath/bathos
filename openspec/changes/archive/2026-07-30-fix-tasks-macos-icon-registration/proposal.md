## Why

The installed Tasks app uses a legacy macOS icon asset that the current system presents as inset rectangular artwork inside its app-icon treatment. Notification Center also retains a stale `BathOS Tasks` widget-provider entry even though only the unified `/Applications/Tasks.app` bundle should remain registered.

## What Changes

- Build the macOS app icon from the existing Tasks PWA artwork with a full-bleed background that fills the system squircle instead of presenting the source rectangle as an inset legacy icon.
- Keep the iOS icon unchanged.
- Ensure the installed Mac app and its WidgetKit provider use the corrected Tasks icon everywhere macOS presents their application identity, including Notification Center's widget selector.
- Remove stale `BathOS Tasks` application and widget registrations after proving that no superseded app bundle remains installed.
- Update the verified installation procedure for the system-level `/Applications/Tasks.app` location.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Require the native Mac app and widget-provider surfaces to use the full-bleed canonical Tasks icon and leave no stale superseded provider registration.

## Impact

- **macOS companion:** App icon resources, Xcode asset configuration, native identity tests, and installation documentation.
- **Installed system state:** LaunchServices and WidgetKit registration cleanup for the superseded `BathOS Tasks` identity.
- **iOS companion:** No icon or behavior change.
- **Web and Supabase:** No runtime, database, or deployment change.
