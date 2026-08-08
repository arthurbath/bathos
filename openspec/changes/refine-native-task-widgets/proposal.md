## Why

The native Tasks widget currently exposes only its large family, wastes horizontal row space, and uses inconsistent unavailable-state and Apple Watch icon treatments. These limitations prevent the same established widget from adapting cleanly to shorter and taller native surfaces.

## What Changes

- Add medium and extra-large list-widget families alongside the existing large family.
- Scale the number of visible tasks to the selected widget family while preserving the same list interactions and visual hierarchy.
- Tighten task-row icon spacing, preserve more Summary width, and size primary-link icons consistently with planning icons.
- Center the unavailable state in the list body and label it `Open Tasks`.
- Increase the stroke weight of the Lucide check used only by the Apple Watch complication.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Native list widgets support medium, large, and extra-large layouts with family-appropriate task counts.
- `tasks-macos-companion`: Native list widgets support medium, large, and extra-large layouts with family-appropriate task counts.

## Impact

- Shared WidgetKit presentation policy and list view layout.
- iOS and macOS widget family declarations and tests.
- Generated Lucide widget icon assets used by the Apple Watch complication.
