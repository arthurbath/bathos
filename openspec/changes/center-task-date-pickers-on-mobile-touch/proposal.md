## Why

On a touch-capable mobile viewport, the software keyboard can cover the Reminder Time input at the bottom of the large Task Start picker because the picker remains anchored to its task field. The Start and Deadline pickers need a responsive modal presentation that follows the visible viewport without changing their established anchored behavior on desktop or larger touch layouts.

## What Changes

- Present Task Start and Deadline pickers as centered modal popovers with a standard backdrop when the device is touch-capable and the viewport is below the BathOS mobile breakpoint.
- Keep both pickers anchored to their triggering fields on non-touch devices and on larger touch viewports.
- Position and bound the mobile modal popover against the visual viewport and safe areas as the software keyboard opens, scroll overflowing picker content internally, and reveal the focused Reminder Time input.
- Preserve picker dismissal, typed reminder commitment, focus restoration, date restrictions, keyboard operation, and nested Reminder Time menu behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define responsive modal presentation and visible Reminder Time editing for Task Start and Deadline pickers on touch-capable mobile viewports.

## Impact

- Tasks module editor and Start picker presentation
- Shared date-picker and popover presentation helpers
- Shared visual-viewport and touch/mobile detection utilities
- Focus, backdrop, overflow, nested-menu, and responsive interaction tests
- No database, Supabase, synchronization, or native Swift changes
