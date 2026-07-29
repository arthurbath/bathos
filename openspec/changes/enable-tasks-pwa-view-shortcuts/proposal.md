## Why

Some browsers, including Safari's installed macOS web-app shell, reserve Command+1 through Command+6 before Tasks can receive the keyboard event. Tasks needs a dependable web shortcut for direct view navigation that browsers do not commonly absorb.

## What Changes

- Add Control+1 through Control+6 as the reliable web commands for Today, Upcoming, Anytime, Someday, Done, and Config on Mac.
- Preserve the existing Command-number aliases where a browser delivers them, without advertising those unreliable aliases in the web keyboard-command help.
- Show Control-number for both Mac and Windows in the web keyboard-command help.
- Add domain and mounted-shell coverage for the new Mac Control-number path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make Control-number the documented, cross-browser web command for direct Tasks view navigation while retaining compatible Command-number aliases.

## Impact

- Affects the Tasks keyboard-command resolver, keyboard help, tests, and durable Tasks specification.
- Does not change Supabase, production data, dependencies, PWA installation, or non-Tasks module behavior.
