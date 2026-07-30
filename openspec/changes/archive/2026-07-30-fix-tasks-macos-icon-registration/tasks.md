## 1. Canonical Mac Icon

- [x] 1.1 Replace the legacy macOS AppIcon raster set with a Mac-only full-bleed Icon Composer source derived from the Tasks PWA artwork
- [x] 1.2 Update the Xcode project and native tests to require the modern icon source while preserving the iOS asset
- [x] 1.3 Build and inspect the compiled Mac icon output to prove the background reaches the system mask

## 2. Native Validation

- [x] 2.1 Run the macOS companion tests and unsigned build
- [x] 2.2 Run an iOS companion regression build and strict OpenSpec validation
- [x] 2.3 Update the system-level verified-installation documentation

## 3. Signed Installation And Registration

- [x] 3.1 Build and strictly verify the automatically signed Mac app and embedded widget
- [x] 3.2 Replace `/Applications/Tasks.app` with the verified build without disturbing the shared App Group or WebKit data
- [x] 3.3 Prove no superseded app bundle remains, remove the stale `BathOS Tasks` registration, and re-register the current Tasks app and widget
- [x] 3.4 Verify the corrected icon and singular Tasks identity in installed macOS surfaces
