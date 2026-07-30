## Context

The iOS and macOS companions currently reuse the same flattened 1024-pixel PNG through different asset catalogs. On current macOS, the legacy multi-size `AppIcon.appiconset` is presented as rectangular artwork inside the system's app-icon treatment rather than as a full-bleed modern icon. The installed unified app now lives at `/Applications/Tasks.app` with bundle identifier `garden.bath.tasks`, while no superseded `BathOS Tasks.app` is present in `/Applications` or `~/Applications`. The remaining `BathOS Tasks` widget-selector row is therefore stale system registration state.

## Goals / Non-Goals

**Goals:**

- Give the Mac companion a modern full-bleed icon derived from the existing Tasks PWA artwork.
- Let macOS apply its native squircle, material, and widget-provider presentation without embedding a second rectangle inside that shape.
- Preserve the existing iOS icon unchanged.
- Ensure Finder, Dock, application menus, Spotlight, and Notification Center use the same corrected Tasks identity.
- Remove stale registration of the superseded `BathOS Tasks` application and widget provider without deleting user data or the current app.

**Non-Goals:**

- Redesigning the canonical white SquareCheckBig-on-black Tasks artwork.
- Changing app, widget, App Group, or WidgetKit identifiers.
- Changing widget functionality, web behavior, or production data.
- Deleting arbitrary caches or resetting unrelated LaunchServices registrations.

## Decisions

### Use a macOS-only Icon Composer source

The Mac target will replace its legacy multi-size `AppIcon.appiconset` with an `AppIcon.icon` source. The composition uses the PWA artwork as its visual authority, separates the black full-bleed background from the white SquareCheckBig foreground, and declares macOS square support. This lets the current Apple toolchain compose native icon variants and apply the system mask at presentation time.

Keeping the flattened legacy raster set was rejected because that is the path producing the inset presentation. Modifying the iOS asset was rejected because its existing icon already renders correctly.

### Keep the full-bleed background in the composition

The Icon Composer fill owns the entire icon background. The white glyph is a foreground vector layer derived from the same Lucide geometry used by the PWA icon. The source does not include rounded corners or a pre-rendered outer plate, so the macOS squircle clips the rectangular composition naturally.

### Clean only the superseded registered identity

Before cleanup, the installation procedure must prove that `/Applications/Tasks.app` has the intended display name, app and widget bundle identifiers, App Group entitlement, and valid signatures, and must prove that no `BathOS Tasks.app` bundle remains in the standard application locations. Cleanup then unregisters only stale bundle paths or providers associated with the superseded name and refreshes LaunchServices and WidgetKit discovery. The current Tasks bundle is explicitly re-registered afterward.

The procedure will not delete the shared App Group container, WebKit data, authentication state, widget data, or unrelated system registrations.

## Risks / Trade-offs

- **Icon Composer output differs across macOS releases** → Keep the canonical geometry and colors simple, validate the compiled icon output, and inspect the installed icon on the current system.
- **Widget selector caches the old display name after bundle removal** → Refresh the bounded LaunchServices and WidgetKit registrations and restart only the responsible UI services if needed.
- **Removing the wrong registration could hide the current widget** → Resolve and verify every bundle path and identifier before unregistering, then explicitly register `/Applications/Tasks.app`.
- **System icon caches can lag after installation** → Preserve the correct installed bundle and use a bounded cache refresh rather than changing identifiers.

## Migration Plan

1. Replace only the Mac icon asset source and update the Xcode target resource reference.
2. Add source and compiled-output tests for the canonical name, icon resource, and unified identifiers.
3. Run unsigned Mac tests and an iOS regression build.
4. Build and strictly verify the signed Mac app and embedded widget.
5. Replace `/Applications/Tasks.app` only after verification.
6. Prove no superseded app bundle remains, remove its stale registration, re-register Tasks, and refresh bounded icon/widget discovery.
7. Visually verify Finder/Dock and Notification Center show the corrected `Tasks` icon and no separate `BathOS Tasks` provider.

Rollback reinstalls the last verified `Tasks.app` bundle and re-registers it. No user data migration or database rollback is involved.

## Open Questions

None.
