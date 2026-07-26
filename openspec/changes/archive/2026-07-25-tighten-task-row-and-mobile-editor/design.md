## Context

The primary task lists now use 44-pixel flat rows. Their title and trailing controls still retain the older visual weight and 40-pixel control footprints, which makes the right edge feel crowded relative to the new row density. The expanded editor currently switches both field pairs to one column below the `sm` breakpoint, despite the supported mobile viewport providing enough width for two compact controls.

## Goals / Non-Goals

**Goals:**

- Reduce task-title emphasis and trailing-control footprint without changing row height.
- Keep source-link and ellipsis targets centered and operable at mobile sizes.
- Preserve two-column temporal and identity field pairs across supported mobile widths.
- Make the Deadline trigger use the editor's ordinary text size at mobile widths.

**Non-Goals:**

- Change task-row height, metadata content, keyboard focus, selection, or open/close behavior.
- Redesign the Start picker, Deadline calendar, selects, notes editor, or Primary Link field.
- Change shared date-picker typography outside the Tasks editor.

## Decisions

### Use normal task-title weight

Active, Done, and Trash task rows will use the ordinary 15-pixel normal-weight title treatment. Metadata remains smaller and muted, preserving hierarchy without bold type.

### Group compact trailing controls

The source-link indicator will accept a compact presentation used by task rows, and the ellipsis trigger will use the same 32-pixel square. The two controls will sit in one vertically centered group with a 2-pixel internal gap. The source indicator's default 40-pixel presentation remains available to hierarchy and project contexts.

### Keep editor field pairs in two columns

The temporal and identity grids will use two columns without a responsive stacking breakpoint. Existing equal grid tracks and 12-pixel gaps remain. Labels and trigger content continue truncating rather than increasing the grid width.

### Override only the Tasks Deadline text size

The Tasks editor will pass its ordinary `text-sm` presentation to the shared Deadline trigger. The shared DatePickerField default remains unchanged for other BathOS surfaces.

## Risks / Trade-offs

- [Long organization values may truncate sooner] -> Preserve the existing one-line select truncation and verify realistic long content at the mobile viewport.
- [Smaller trailing controls reduce pointer area] -> Retain 32-pixel controls with clear hover treatment and full task-row vertical centering, then verify mobile interaction.
- [Normal-weight titles may lose hierarchy] -> Preserve foreground contrast, 15-pixel size, and the existing muted metadata treatment.
