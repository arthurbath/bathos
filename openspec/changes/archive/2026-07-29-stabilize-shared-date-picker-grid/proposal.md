## Why

BathOS date pickers currently use a Sunday-first, variable-height calendar grid, so weekday placement differs from the desired convention and the paging controls can shift vertically between months. Keyboard users can also lose their navigation position when paging backward into the earliest allowed month causes the now-unavailable previous-month control to disappear.

## What Changes

- Make every shared BathOS date picker begin its week on Monday.
- Render exactly six calendar week rows for every displayed month, filling unused rows with adjacent-month dates.
- When keyboard activation of Previous Month reaches the earliest legal month and that control becomes unavailable, move focus to the centered month-and-year control.
- Add regression coverage for weekday order, fixed grid geometry, and the keyboard focus handoff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Extend the shared date-picker contract with Monday-first weekday order, a stable six-row day grid, and deterministic focus recovery at the backward paging boundary.

## Impact

- Shared component: `src/components/ui/calendar.tsx`
- Shared tests: `src/components/ui/calendar.keyboard.test.tsx`
- Affected consumers: every BathOS surface using the shared Calendar, including Tasks Start and Deadline pickers and Garage and Snake date pickers
- No Supabase, API, route, migration, or dependency changes
