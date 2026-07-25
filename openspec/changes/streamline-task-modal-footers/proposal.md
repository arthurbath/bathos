## Why

Tasks modals currently spend space on redundant “Escape Closes” copy and leave a visually empty footer chin when no footer action exists. The Keyboard Commands panel also uses unnecessary plus signs that make already-symbolic shortcuts harder to scan.

## What Changes

- Present keyboard chords without plus signs between modifiers and keys.
- Open Keyboard Commands with Command+/ on Mac or Control+/ on Windows, including while a task field is active.
- Remove the persistent Keyboard Commands question-mark button from the Tasks header.
- Keep Keyboard Commands discoverable through a platform-aware cue on Config.
- Keep the focused Keyboard Commands container free of a decorative outline or ring.
- Render keyboard chord descriptions in the regular interface typeface at the table's normal text size.
- Remove every visible “Escape Closes” hint from Tasks modals.
- Render Tasks dialogs without a footer row, bottom divider, or empty chin when they have no footer actions.
- Preserve explicit modal footers that contain meaningful actions such as Save, Cancel, Close, or confirmation buttons.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine Keyboard Commands notation and the footer contract for Tasks dialogs.

## Impact

- Tasks command, search, quick-find, planning, synchronization, and start-picker dialogs.
- Tasks global keyboard handling, persistent header, and Config view.
- The shared dialog primitive gains an explicit footerless layout option.
- Tasks UI regression coverage and durable Tasks documentation.
- No database, synchronization, MCP, or production-topology changes.
