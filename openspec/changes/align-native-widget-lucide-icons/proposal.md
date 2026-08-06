## Why

Tasks widgets currently mix hand-drawn approximations and Apple SF Symbols with the canonical Lucide icons used by the Tasks web interface. This weakens the shared visual vocabulary across iOS, macOS, watchOS, and the web even though WidgetKit can render bundled custom vector content.

## What Changes

- Add a dependency-free native Lucide renderer for the bounded set of icons used by Tasks widgets and complications.
- Replace SF Symbol and approximate widget icons with the exact canonical Lucide choices for task state, list identity, Today horizons, recurrence, Primary Link protocols, add actions, empty states, and the watch complication.
- Keep WidgetKit rendering semantic and platform-aware, including monochrome accessory rendering, semantic color, accessibility labels, and existing control behavior.
- Add a contract test that guards native widget icon assignments against the canonical Tasks icon map.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Require the iOS list and control widgets to render the canonical Tasks Lucide vocabulary.
- `tasks-macos-companion`: Require the shared macOS widget to use the same canonical Lucide vocabulary as the Tasks application and iOS widget.
- `tasks-watch-companion`: Require the complication center mark to use the canonical Lucide checkmark geometry.

## Impact

- Affects the shared SwiftUI WidgetKit implementation, watchOS complication, native project source membership, and focused native icon contract tests.
- Adds no runtime package, database, API, migration, projection-schema, or network changes.
- Leaves the native application icon, widget data model, task actions, navigation, and refresh behavior unchanged.
