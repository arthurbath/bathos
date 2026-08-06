## Why

Global Quick Entry currently embeds a second copy of the complete BathOS web application inside an `NSPanel`. That makes a supposedly immediate capture surface dependent on WebKit navigation, authentication restoration, PowerSync startup, and React readiness, producing long waits and failure states that a global shortcut should never expose.

## What Changes

- Replace the web-hosted macOS Quick Entry editor with a SwiftUI form that appears synchronously and remains usable without loading a second BathOS document.
- Preserve the ordinary Tasks creation workflow's field order, visual hierarchy, validation, keyboard traversal, metadata shortcuts, date semantics, checklist drafting, and explicit Save and Cancel behavior in the native editor.
- Introduce a versioned, machine-readable Quick Entry contract that is authoritative for shared field definitions, defaults, enumerations, validation limits, and shortcut ownership, with parity tests that fail when TypeScript and Swift drift.
- Add a narrow owner-and-installation-bound native bootstrap and mutation service that returns editable Areas and planning context, then creates one complete task, checklist, and reminder transaction idempotently.
- Keep the existing main macOS Tasks web surface and its authenticated bridge, but remove Quick Entry's dependency on a dedicated `WKWebView`, web loading shell, JavaScript shortcut forwarding, and web readiness handoff.
- Refresh the main Tasks surface and native widgets after a successful native capture without delaying panel dismissal on a full web reload.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `tasks-macos-companion`: Global Quick Entry becomes a truly native, immediately available editor backed by a bounded authenticated task-creation service.
- `personal-tasks-module`: The ordinary task-creation workflow exposes an enforceable versioned contract so native Quick Entry preserves field, validation, shortcut, checklist, reminder, and placement semantics.

## Impact

- macOS companion SwiftUI/AppKit panel code, native tests, shared Apple task models, and Xcode target membership.
- Tasks domain contracts, task-creation validation, keyboard-command metadata, and parity tests.
- The Tasks native bridge and shared App Group credential lifecycle.
- The `tasks-widget-actions` Edge Function or a successor native-action surface, plus narrow Supabase RPCs and pgTAP coverage for bootstrap and atomic idempotent creation.
- Existing web task editing and ordinary task instances remain unchanged. Production schema or function deployment will require a guarded preflight and explicit approval before rollout.
