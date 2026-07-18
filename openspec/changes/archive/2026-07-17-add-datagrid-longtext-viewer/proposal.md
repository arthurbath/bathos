## Why

Long text stored in compact DataGrid cells is difficult to read without entering edit mode or resizing the column. BathOS needs an opt-in way to expose the complete value while preserving the grid's dense editing experience.

## What Changes

- Add an opt-in `longtext` designation to shared editable text cells.
- Show a magnifying-glass action to the right of a designated longtext cell input.
- Open a read-only modal popover that presents the field's full text when the action is activated.
- Use a compact header-and-body modal layout whose content reaches the rounded bottom edge without a footer chin or divider.
- Give the read-only content body equal top and bottom padding.
- Designate the Garage Services and Servicings Notes columns as longtext.
- Preserve existing DataGrid keyboard navigation, focus, editing, and save behavior.

## Capabilities

### New Capabilities

- `data-grid-longtext`: Defines the opt-in longtext cell affordance and full-content viewer behavior.

### Modified Capabilities

None.

## Impact

- Shared UI: `src/components/ui/data-grid.tsx` and focused DataGrid tests.
- Garage module: the Services and Servicings grid Notes columns and their focused tests.
- No database, Supabase, routing, or external API changes.
