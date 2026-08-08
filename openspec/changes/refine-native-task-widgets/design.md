## Context

The existing native list widget uses one shared SwiftUI implementation on iOS and macOS, but hard-codes the large family and a ten-row cap. Its row layout also gives the completion target a large interactive frame without compensating for that frame when a horizon marker follows it.

## Goals / Non-Goals

**Goals:**

- Preserve one shared widget implementation across supported families.
- Show fewer tasks in medium widgets and more in extra-large widgets.
- Preserve interactive completion, task, primary-link, and add-task destinations.
- Improve horizontal rhythm without reducing functional icon targets.

**Non-Goals:**

- Add a system-small list widget whose available width cannot preserve the established row interactions.
- Change snapshot payload limits or server query semantics.
- Add new Apple Watch complication families.

## Decisions

### Use WidgetKit families, not geometry inference

`systemMedium`, `systemLarge`, and `systemExtraLarge` are explicit WidgetKit families and receive explicit task caps of four, ten, and sixteen. The view reads `widgetFamily` rather than estimating a grid size from pixels.

### Preserve large interaction targets while compensating visually

The completion control retains its established interactive frame. A nested leading cluster offsets the invisible frame padding so the visible checkbox-to-context and context-to-Summary gaps have the same rhythm. The trailing primary-link icon matches the horizon icon size and uses only the minimum separation required to avoid collision.

### Keep generated iconography authoritative

The complication-specific Check asset receives a contract-defined stroke width. The icon generator remains the only writer of the SVG catalog.

## Risks / Trade-offs

- Extra-large widgets are available only on platforms and placements supported by WidgetKit; declaring the family does not force an unsupported placement to appear.
- A family cap is intentionally conservative so rows never collide with the header at accessibility text sizes.

## Migration Plan

No data migration is required. Rebuild the native applications and widget extensions after validation.
