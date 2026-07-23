## Why

BathOS Tasks is intended to be keyboard-first personal software, but its current command set, bulk planner, search surface, and row metadata do not yet support the fast planning and retrieval workflows required for daily use. The interaction model also needs several focused corrections so selection, date presentation, and Primary Link editing remain predictable.

## What Changes

- Add modifier-based commands for Today placement and horizon cycling, Anytime and Someday movement, start and due date selection, duplication, organization movement, reminder focus, global find, and Config navigation.
- Apply applicable single-task commands to the active multi-selection, including centered bulk date, organization, and reminder command surfaces.
- Let Escape exit multi-selection, rename Clear to Select None, and move the selection toolbar to a fixed bottom overlay with protected list scroll space.
- Replace the existing broad search dialog with a three-result quick find across to-dos, projects, and areas plus a live full-results page.
- Present Start and Due metadata with the requested Lucide icons and use forward-looking Upcoming copy.
- Make Primary Link explicitly clearable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand the existing keyboard, bulk planning, search, scheduling, row-presentation, and Primary Link interaction contracts.

## Impact

The change is confined to the Tasks module and its OpenSpec contract. It affects task command parsing, Tasks shell orchestration, task editor command targets, bulk command dialogs, task search projection and presentation, task duplication, row metadata, focused tests, and the keyboard-command reference. It adds no database migration, Supabase deployment, dependency, or cross-module import.
