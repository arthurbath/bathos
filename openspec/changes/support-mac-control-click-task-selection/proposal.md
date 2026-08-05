## Why

macOS users can currently begin or modify task selection with Command-click, but Control-click invokes the native context-menu gesture instead of providing the same Tasks selection behavior. Supporting both modifiers makes task selection consistent with the user's preferred Mac interaction without changing Windows behavior.

## What Changes

- Treat Control-click on an eligible to-do row on macOS the same as Command-click for beginning or modifying selection mode.
- Suppress the native context menu only for the handled Control-click task-selection gesture.
- Preserve ordinary clicks, native context menus outside eligible to-do activation surfaces, and existing Windows Control-click behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend modified-click task selection so macOS accepts either Command-click or Control-click.

## Impact

- Tasks pointer-selection domain logic and eligible to-do row activation handlers.
- Tasks selection tests and durable Tasks behavior specifications.
- No database, API, migration, dependency, or cross-module impact.
