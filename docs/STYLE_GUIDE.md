# BathOS Style Guide

## Design Philosophy

Black-and-white minimalism. Clean, pragmatic, data-focused. No decorative gradients. Shadows only for functional layering (e.g., dropdowns, modals).

## Colors

Colors are semantic, not decorative:

| Token | Usage |
|---|---|
| `primary` | Near-black. Buttons, links, focus rings, text |
| `success` | Green. Confirmation, positive states |
| `warning` | Yellow. Caution states |
| `destructive` | Red. Errors, danger, destructive actions |
| `info` | Blue. Informational, help text |
| `admin` | Purple. Admin privilege indicators only |

Never use colors purely for decoration. Every color must carry meaning.

## Typography

- Body: Inter (system-ui fallback)
- Icons: Lucide React (inline SVGs, tree-shakable)
- No custom display fonts. Let the content speak.
- Page and card headings: `text-2xl font-semibold leading-none tracking-tight` (same style as Budget Expenses heading).
- Use default `CardTitle` for card headings. Do not downsize card headings with local overrides like `text-base`.

## Voice

- Pragmatic and neutral
- No exclamation points, even for destructive actions
- No marketing language in the UI
- Helper text is used sparingly — prefer self-evident UI
- Subtext beneath page, section, card, and modal headings is off by default. Add heading subtext only when explicitly requested.

## Label Casing

Use Title Case for:

- Buttons
- Input Labels
- Dropdown Menu Options
- Modal Titles
- Section Titles

Use lowercase for these words when they appear in the middle of a label:
`a`, `an`, `and`, `as`, `at`, `by`, `for`, `from`, `if`, `in`, `n` (for "and"), `o` (for "of"), `of`, `on`, `or`, `tha` (for "the"), `the`, `to`, `wit` (for "with"), `with`.

## Icons

- All iconography uses Lucide React (`lucide-react`)
- Icons are inline SVGs — no image files, no emoji
- Use sparingly. Not every element needs an icon.

## Spacing and Sizing

- Consistent use of Tailwind spacing scale
- Mobile-first responsive design
- Max content width: `max-w-5xl` for data views, `max-w-lg` for forms
- Cards use standard `Card` component with minimal padding

## Data Grid Card Convention

- When a `DataGrid` is rendered inside a `Card`, the grid must span the full card width.
- Use `CardContent` with horizontal padding removed (`px-0`) for the grid section.
- If the card also includes non-grid controls above/below the grid, wrap those controls in an inner padded container (`px-6`) so control spacing remains consistent while the grid stays edge-to-edge.
- Default behavior conventions for all new `DataGrid` instances:
  - Column headers are sortable for data columns (except the trailing actions column).
  - Column headers are resizable for all non-fixed data columns (including utility columns such as color swatches).
  - Minimum width for all columns is `60px`.
  - Column resizing must snap in `20px` increments (`GRID_RESIZE_STEP`) for every DataGrid, in cards and full-view layouts.
  - Column width preferences must persist via the shared `useGridColumnWidths` flow:
    - cached in `localStorage` for immediate application on load
    - synced to `bathos_user_settings.grid_column_widths` for cross-browser persistence
  - Use a trailing `actions` column with an ellipsis trigger (`MoreHorizontal`) and row actions in a dropdown menu.
  - Actions triggers participate in grid keyboard navigation: arrow/tab can focus the ellipsis button, Space/Enter opens its menu, and menu items remain keyboard-focusable/selectable via standard dropdown keyboard behavior.
  - The trailing `actions` column uses the shared fixed width (`40px`) and the same right-edge button spacing used on Expenses/Incomes (`mr-[5px]` on the icon button).
  - If the grid is narrower than its container, assign all leftover width to the trailing `actions` column (do not distribute it across data columns).
  - Fields that support inline editing (for example Name) should be click-to-edit directly in-cell, rather than routed through an actions-menu rename flow.
  - Color swatch controls are treated as inputs: `h-7`, no extra margin, gray input border (`--grid-sticky-line`), standard input focus ring, keyboard/grid navigation focuses the swatch input without auto-opening the menu, and Space/Enter opens the swatch menu with focus landing on the selected swatch (or first swatch when none is selected).
  - New rows in a data-grid card are created from a `+` button in the card header that opens a modal form; do not use inline add rows above the grid.
  - The standard DataGrid add button style is the compact green outline icon button used by Budget Expenses/Incomes: `variant="outline-success"`, `size="sm"`, `className="h-8 w-8 p-0"`, with a `Plus` icon and an `aria-label`.
  - Use column meta flags consistently: `containsEditableInput` for inline form controls, `containsButton` for button/menu cells, so shared grid padding and row-height rules are applied correctly.

## Full-View Data Grid Convention

- For dense operational tables (for example Budget Expenses), use the full-view grid pattern instead of a constrained card layout.
- Full-view pattern requirements:
  - Route-level container uses a `flex` + `min-h-0` layout so the grid can own available vertical space.
  - Grid card uses the full-bleed shell treatment (`w-[100vw]`, centered transform, `rounded-none`, no side borders).
  - `CardContent` wraps the grid with `flex-1 min-h-0`.
  - `DataGrid` is rendered with `fullView` enabled, `maxHeight="none"`, and `className="h-full min-h-0"`.
- Use this same pattern for new module tables that are primary workflow surfaces (not just summary cards).

## Data Grid Filters Convention

- When a data-grid card offers filter/grouping controls, use the Budget Expenses control pattern:
  - Primary `Filters` button: `variant="outline"`, `size="sm"`, `className="h-8 gap-1.5"`, with `Filter` icon.
  - Conditional clear button appears only when any filter/grouping is active:
    - `variant="outline-warning"`, `size="sm"`, `className="h-8 w-8 p-0"`, `FilterX` icon, `aria-label="Clear filters and groupings"`.
  - Keep filter edits in draft state inside the modal and apply on `Save`; `Clear` resets active controls immediately to defaults.

## Grouped Grid Row Convention

- When grouping is applied to a grid, group header rows should display label and row count in the first sticky cell as:
  - `Group Label (N)`
- Apply this consistently across modules so grouped tables expose comparable density and scanability.

## Form Modal Interaction

All form-style modals (Add/Edit dialogs) must follow one keyboard interaction model:

- Tab moves focus forward through every interactive field in top-to-bottom order; Shift+Tab moves backward.
- Inputs use native editing behavior on focus (no separate focus/edit modes).
- Selects are keyboard-usable from the trigger: Space/Enter opens, arrow keys navigate options, Enter/Space confirms.
- Checkboxes keep/receive focus when toggled so tabbing can continue naturally afterward.
- Custom controls (e.g., color pickers) must remain in the normal tab order and be keyboard operable.

This is a standing standard for all new and updated form modals.

## Tooltip Interaction

For dotted-underline tooltip text triggers, use the persistent interaction model:

- Hover, tap, or click opens the tooltip.
- Repeated taps/clicks on the same trigger do not dismiss it.
- Tooltip closes only when the pointer leaves the trigger text or when the user taps/clicks elsewhere in the UI.

## Link Navigation Convention

- In-app navigation links must behave like normal links for modified clicks:
  - CMD/CTRL-click and middle-click open in a new tab.
  - Plain left click uses client-side navigation.
- Implement navigational UI using real anchors (`<a href="...">`) and intercept only plain left clicks for SPA routing.

## Bookmark and App Icon Metadata Convention

- Route metadata must be module-aware for bookmarking and install surfaces (for example iOS Home Screen and Safari Add to Dock).
- On module routes, use the module name only as the page/app name (for example `Budget`, `Drawer Planner`, `Garage`, `Administration`), never `BathOS - <Module>`.
- On module routes, use that module's dedicated icon asset from `public/` for app icon metadata (`icon`, `apple-touch-icon`, module manifest icons).
- On gateway/platform routes (for example launcher, account, and other non-module pages), use `BathOS` as the page/app name and use the default BathOS icons/manifest.
- Metadata must update on client-side route changes and reset correctly when navigating between module and platform routes.

## Shadows and Borders

- Borders: 1px, using `border` token
- Shadows: Only for elevated elements (dropdowns, modals, active tabs)
- No decorative box shadows on cards or sections

## Theme Mode

BathOS is a dark app. Do not design or implement a light theme, and do not introduce runtime theme switching.

Dark-surface rules:

- Backgrounds and surfaces stay dark by default.
- Text, icons, and borders are light for contrast.
- Keep using semantic tokens from `index.css`; they should resolve to the dark palette.
