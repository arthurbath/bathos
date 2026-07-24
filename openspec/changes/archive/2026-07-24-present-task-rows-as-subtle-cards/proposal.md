## Why

The newly compact task rows fit more work on screen, but full-width divider lines make adjacent to-dos read as one continuous table. Subtle rounded containers will give each planning item a clearer visual boundary while preserving BathOS's restrained dark appearance.

## What Changes

- Replace the top-and-bottom divider treatment around active task lists with individually bounded rounded rows.
- Add a very small vertical gap between adjacent task rectangles.
- Use a barely differentiated semantic surface and quiet border without shadows or decorative color.
- Restore a small amount of spacing between the title and metadata lines while preserving the 56-pixel collapsed height.
- Preserve selected, bulk-selected, expanded, dragging, focus, and terminal-transition states within the rounded boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refines the established compact list-density contract with subtle rounded item containers and a slightly larger title-to-metadata gap.

## Impact

- Affects the Tasks active planning-list wrappers, active to-do row presentation, planning-project rows shown alongside to-dos, and component tests.
- Does not change data, Supabase objects, synchronization, task ordering, interaction behavior, or other BathOS modules.
