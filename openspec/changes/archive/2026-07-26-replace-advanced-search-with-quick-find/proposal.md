## Why

Tasks currently exposes a prominent advanced search dialog while its faster Quick Find surface is no longer directly accessible. Most personal lookup needs are better served by immediate type-ahead search that can be entered from any Tasks view without first invoking a command.

## What Changes

- **BREAKING** Replace the persistent header magnifying-glass action's advanced search dialog with Quick Find.
- Open Quick Find automatically when a user begins typing printable search text from an eligible non-editable Tasks surface.
- Seed Quick Find with the initiating character and continue accepting typed input without losing the first keystroke.
- Support type-to-search from every Tasks route, including Config and hierarchy/detail views.
- Preserve native typing, composition, shortcuts, and control activation inside editable controls and nested interaction surfaces.
- Keep Quick Find's existing compact best-match results and Continue Search handoff to the full results route.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make Quick Find the primary Tasks search entry point and add safe route-wide type-to-search activation.

## Impact

This is a web-only Tasks interaction change affecting the Tasks shell, Quick Find component, advanced search trigger wiring, keyboard event ownership, human documentation, OpenSpec contracts, and focused UI tests. It changes no database schema, synchronization behavior, production data, dependency, or public API.
