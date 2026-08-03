## Why

The watch complication's system gauge is visually heavier than the requested simple progress ring, while a missing one-time companion credential currently blocks capture with an instruction to open the iPhone app. The watch experience should recover its narrow authority automatically and send task content directly to the existing server endpoint.

## What Changes

- Replace the accessory gauge with one solid circular track whose progress stroke begins at 12 o'clock, fills clockwise, and retains the centered checkmark.
- Make the watch request its narrow owner credential from the paired iPhone in the background when local authority is missing or expired.
- Hold a submitted summary only in watch memory while that credential request is pending, then send the task directly from the watch to the existing owner-scoped Edge Function.
- Keep task summaries out of Watch Connectivity payloads and avoid requiring the iPhone Tasks UI to open for ordinary capture.
- Use the shared `Tasks Apple Native Icon.icon` Icon Composer asset for the watch app.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-watch-companion`: Simplify complication rendering and replace the manual missing-authority instruction with an automatic background credential recovery flow.

## Impact

- watchOS app and WidgetKit complication SwiftUI
- iOS/watchOS Watch Connectivity credential handoff
- Existing `tasks-widget-actions` capture endpoint and private credential authority are reused without schema or API expansion
- iOS Xcode project watch icon asset configuration
