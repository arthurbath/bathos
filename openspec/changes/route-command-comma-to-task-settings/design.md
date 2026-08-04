## Context

The macOS Tasks companion already maps native Command+number shortcuts to `TasksMacDestination` values and routes them through the shared `TasksBrowserModel`. Settings is already represented by `.settings` and Command+6, but the app does not claim the conventional macOS Command+, application-settings shortcut.

## Goals / Non-Goals

**Goals:**

- Make Command+, open the existing Tasks Settings route.
- Ensure the shortcut works while WebKit content has focus.
- Represent Settings in the macOS application menu using the conventional command.
- Preserve all current navigation and web shortcut behavior.

**Non-Goals:**

- Create a separate native Settings window.
- Change the web Settings route or Settings UI.
- Change shortcuts on iOS, watchOS, or ordinary web browsers.

## Decisions

- Extend the existing `TasksMacKeyboardController.destination` resolver to recognize the exact Command+, chord and return `.settings`. This keeps WebKit from consuming the event and reuses the same destination path as Command+6.
- Replace the default SwiftUI application Settings command with a Tasks Settings menu item bound to Command+,. This makes the shortcut conventional and discoverable in the application menu without opening a second native window.
- Retain Command+6 as an additional navigation shortcut for Settings. Command+, is an alias, not a replacement.
- Cover the resolver with unit tests for the accepted chord and rejected modifier variants.

## Risks / Trade-offs

- [Risk] Both the local event monitor and the menu command declare Command+,. → The local monitor consumes active-window key events before menu dispatch, while the menu remains the semantic fallback and visible command. Both invoke the same route and cannot produce duplicate navigation.
- [Risk] A future native Settings scene could conflict with the replacement command. → Keep the replacement explicitly routed to the BathOS Settings view until a separate native Settings scene is intentionally introduced.
