## Why

Command+, is the conventional macOS shortcut for application settings, but the Tasks companion currently exposes its Settings view only through Command+6. The native app should own the conventional shortcut so it reliably opens the existing in-app Settings route even when WebKit has focus.

## What Changes

- Add a native macOS application Settings command bound to Command+,.
- Route Command+, through the existing native Tasks destination resolver to the existing Settings web view.
- Preserve the existing Command+1 through Command+6 navigation shortcuts and web-owned Control shortcuts.
- Add native regression coverage for the exact modifier and key combination.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Extend native macOS navigation commands so Command+, opens the existing Tasks Settings view.

## Impact

- Affects the macOS Tasks companion command menu, native keyboard event routing, and native unit tests.
- Does not alter the web Tasks module, database schema, Supabase services, iOS app, or watchOS app.
