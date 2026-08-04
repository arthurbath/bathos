## Context

The accessory-circular complication currently has no explicit activation URL, so WidgetKit launches the watch app at its ordinary root view. That view intentionally presents a single plus control backed by `TextFieldLink`. SwiftUI does not expose a programmatic activation binding for `TextFieldLink`, but watchOS still exposes the system text-input controller used for dictation, Scribble, and keyboard entry.

## Goals / Non-Goals

**Goals:**

- Make a complication tap visibly open the watch app and immediately present system text entry.
- Reuse the existing task submission, authority recovery, validation, idempotency, and status behavior.
- Leave direct app launches on the plus-control screen.
- Treat cancellation as a no-op that returns to the plus-control screen.

**Non-Goals:**

- Change complication progress or refresh behavior.
- Add task-list browsing or metadata editing to watchOS.
- Change server APIs, credentials, or task creation semantics.

## Decisions

### Use a dedicated complication capture URL

The complication view will declare a watch-only custom URL. The watch app recognizes exactly that route through a shared, pure launch policy and ignores unrelated URLs. This preserves the difference between an ordinary app launch and a complication capture launch and makes the route unit-testable.

### Present the native text-input controller after the app is visible

On the recognized URL, the watch model will request the visible WatchKit interface controller and present its system text-input controller. Because URL delivery can precede interface-controller availability during a cold launch, presentation will retry briefly on the main actor. The request is idempotent while presentation is pending so repeated lifecycle delivery cannot stack input controllers.

The resulting nonblank string enters the existing `submit` path. Cancellation or whitespace creates no task and leaves the root plus control visible.

### Keep the plus control unchanged

The existing `TextFieldLink` remains the ordinary in-app entry control. The new bridge exists only because that SwiftUI component has no public programmatic activation API.

## Risks / Trade-offs

- **Cold-launch interface controller is temporarily unavailable** -> Retry presentation for a short bounded interval after URL delivery.
- **WidgetKit or watchOS drops an unsupported URL scheme** -> Register the route scheme in the watch app and verify the widget and app targets build together.
- **Duplicate route delivery presents more than one input controller** -> Track one pending/presented capture request and ignore another until completion or cancellation.
- **Legacy WatchKit presentation API coexists with SwiftUI** -> Scope it to the complication deep-link bridge and retain `TextFieldLink` for ordinary app interaction.
