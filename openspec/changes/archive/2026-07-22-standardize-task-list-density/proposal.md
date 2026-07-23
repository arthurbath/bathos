## Why

Task grouping totals currently read as parenthetical prose, and collapsed to-do rows grow whenever secondary metadata is present. This makes list rhythm inconsistent and makes dense views harder to scan.

## What Changes

- Present every count attached to a Tasks list or grouping heading as a compact neutral badge.
- Give collapsed to-do rows a uniform height across Tasks list surfaces.
- Keep hierarchy, actionability, scheduling, deadline, and reminder metadata within one bounded secondary line so it cannot increase row height.
- Preserve the existing expanded editor behavior, accessibility labels, and task actions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Standardize count presentation and collapsed to-do row density throughout Tasks.

## Impact

- Affects Tasks React presentation components and their component tests.
- Adds no database, Supabase, synchronization, API, or dependency changes.
