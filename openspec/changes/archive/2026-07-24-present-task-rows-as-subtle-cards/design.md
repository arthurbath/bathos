## Context

Primary Tasks planning lists currently wrap adjacent rows in one full-width top-and-bottom border with dividers between records. The compact 56-pixel row now fits well, but the continuous divider treatment does not give each item its own visual boundary.

## Goals / Non-Goals

**Goals:**

- Give each active planning item a quiet rounded rectangular boundary.
- Preserve the dark-only, nearly monochrome BathOS surface with no shadow or decorative color.
- Add only a very small gap between adjacent rectangles.
- Restore a slight title-to-metadata gap without increasing collapsed row height.
- Keep expanded editors and all selection, focus, drag, and transition states within the same boundary.

**Non-Goals:**

- Increase row height or undo the newly compact horizontal padding.
- Redesign search results, hierarchy-detail editors, reminder notices, or deleted-hierarchy recovery rows.
- Change task behavior, data, persistence, ordering, or keyboard interaction.

## Decisions

1. Primary planning-list containers use a 4-pixel vertical gap and no shared divider or outer border. This is enough to reveal the individual rounded shapes without materially reducing list density.
2. Active to-dos and planning projects use the same medium radius, quiet low-contrast border, and approximately two-percent foreground surface tint. No shadow is introduced.
3. Selected and bulk-selected rows replace the base tint with the existing stronger foreground tint while retaining the same border and radius.
4. The metadata line regains a 2-pixel top margin. Its 16-pixel line height and the 20-pixel title line still fit comfortably inside the fixed 56-pixel header.
5. Expanded content remains inside the same clipped article so the open editor reads as an expansion of the selected rectangle rather than a separate panel.

## Risks / Trade-offs

- [Card borders could feel too prominent] -> Use a low-opacity semantic foreground border and validate against the rendered dark background.
- [Inter-card gaps could reduce density] -> Limit the gap to 4 pixels and retain the 56-pixel collapsed row.
- [Rounded clipping could hide focus treatment] -> Keep controls inset within the row and exercise focus and open-editor interactions in rendered QA and regression tests.
