## 1. Shared Apple Companion Foundation

- [x] 1.1 Make the large Tasks widget renderer and supported-family declaration compile for iOS and macOS from shared source.
- [x] 1.2 Preserve the iOS large, Lock Screen, and Control Center targets while adding Mac-only family coverage.
- [x] 1.3 Add shared tests for Mac route, widget-family, presentation, completion, Primary Link, and cache behavior.

## 2. Native macOS Host

- [x] 2.1 Create the macOS SwiftUI app, persistent app-bound `WKWebView`, dark launch surface, and retryable load recovery.
- [x] 2.2 Add trusted route handling, custom deep links, external navigation through `NSWorkspace`, and native widget bridge acceptance.
- [x] 2.3 Add native Command+1 through Command+6 view commands that reuse the existing web view.
- [x] 2.4 Add application-scoped unmodified Escape interception, web forwarding, and full-screen preservation.

## 3. macOS Widget and Project

- [x] 3.1 Create the macOS WidgetKit extension using the shared list widget, intent, snapshot, action, and refresh implementation.
- [x] 3.2 Add stable app, widget, URL scheme, and App Group identifiers, assets, entitlements, schemes, and focused test target.
- [x] 3.3 Document reproducible unsigned validation and verified signed installation.

## 4. Build, Install, and Acceptance

- [x] 4.1 Build and run focused macOS tests with signing disabled and recompile the existing iOS targets after shared edits.
- [x] 4.2 Build the app and widget with compatible Apple automatic signing and fail closed if App Group provisioning is unavailable.
- [x] 4.3 Strictly verify signatures, designated requirements, entitlements, nested extension, and identifiers before installing in `~/Applications`.
- [x] 4.4 Launch the installed app and verify production rendering, internal/external navigation, Command+number routing, full-screen Escape capture, deep links, and widget discovery/behavior where the host permits automation.

## 5. Repository Validation

- [x] 5.1 Run Swift tests, web tests, TypeScript, lint, build, strict OpenSpec validation, and `git diff --check`.
- [x] 5.2 Complete a requirement-by-requirement audit without changing Supabase, PowerSync, production data, or the iOS behavior contract.

## 6. Unified Apple Product Identity

- [x] 6.1 Rename the Mac product, executable, window, widget display name, install path, and documentation to `Tasks`.
- [x] 6.2 Align the Mac app and widget bundle identifiers with the iOS counterparts while preserving the shared App Group, URL scheme, WidgetKit kind, and Apple team.
- [x] 6.3 Rebuild both platforms, verify signed identities and entitlements, replace the old Mac installation, and confirm native widget discovery.
- [x] 6.4 Re-run focused tests, strict OpenSpec validation, and repository hygiene checks.

## 7. Native Split View

- [x] 7.1 Lower the Mac content minimum to a mobile-class width and explicitly preserve resizable full-screen-primary window behavior.
- [x] 7.2 Add focused window-policy coverage, rebuild and strictly verify the signed Mac app, and replace the installed copy.
- [x] 7.3 Run the complete repository release gates, publish the matching web release, and verify the installed Mac build.
