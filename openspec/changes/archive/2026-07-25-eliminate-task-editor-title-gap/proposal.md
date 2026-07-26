## Why

The previous disclosure fix removed explicit form padding but left a hidden margin source: `space-y-3` treats the screen-reader-only Title label as the first child and adds 12 pixels above the title input. That margin becomes visible at the end of the clipped height transition and creates the remaining secondary animation.

## What Changes

- Replace margin-based vertical spacing in the expanded task editor with an equivalent column gap.
- Keep 12-pixel spacing between visible form controls.
- Ensure the title input begins directly at the editor region's top edge with no computed top margin.
- Add regression coverage for both the zero header-to-title gap and preserved inter-field spacing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Tighten the continuous task-editor disclosure contract to forbid margin introduced by nonvisual label elements above the first visible field.

## Impact

- Tasks module only.
- Updates the expanded task editor layout and Tasks shell regression coverage.
- No database, Supabase, PowerSync, API, or deployment configuration changes.
