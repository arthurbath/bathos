## Why

The native Tasks companion already provides a configurable Home Screen widget, but it does not offer the compact Lock Screen surface the user relies on for seeing the next few tasks at a glance. WidgetKit's accessory rectangular family can reuse the existing private list projection and deep-link boundary without creating another task client.

## What Changes

- Add an accessory rectangular Lock Screen presentation to the existing configurable Tasks list widget.
- Let each Lock Screen widget independently choose Today, Upcoming, Anytime, or Someday through the existing widget configuration.
- Show up to the first three cached task summaries in authoritative list order using a compact, monochrome checklist treatment suited to the Lock Screen.
- Open the selected list in the native Tasks app when the user taps anywhere on the Lock Screen widget.
- Preserve the existing large Home Screen widget, native snapshot privacy boundary, refresh behavior, and task actions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Extend the configurable native Tasks widget to support the Lock Screen accessory rectangular family with compact task summaries and a list-level deep link.

## Impact

- **iOS widget extension:** Family-aware SwiftUI presentation and supported-family registration in `TasksListWidget.swift`.
- **Native tests:** Widget-family presentation policy and list deep-link coverage.
- **Documentation:** Companion README and durable Tasks iOS companion behavior.
- **Backend and web application:** No database, Edge Function, PowerSync, projection-schema, credential, or web release change is required.
