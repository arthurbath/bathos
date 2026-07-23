## Why

Upcoming currently sorts projects and to-dos chronologically within separate regions, then renders every project before every to-do. The resulting page can place later work above nearer work, contradicting the purpose of a date-ordered planning view.

## What Changes

- Merge Upcoming projects and to-dos into one date-grouped chronological projection.
- Order every Upcoming date group from the nearest controlling date to the latest.
- Preserve the existing project cards, to-do rows, controlling-date rules, and within-date stable ordering.
- Add regression coverage for dates that alternate between projects and to-dos.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require the complete Upcoming surface, across projects and to-dos, to read from nearest date to latest date from top to bottom.

## Impact

- Tasks module rendering and Upcoming-domain projection helpers.
- Tasks module unit and component tests.
- No Supabase, PowerSync, schema, API, migration, or dependency changes.
