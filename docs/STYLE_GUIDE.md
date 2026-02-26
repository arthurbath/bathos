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
  - Use a trailing `actions` column with an ellipsis trigger (`MoreHorizontal`) and row actions in a dropdown menu.
  - Actions triggers participate in grid keyboard navigation: arrow/tab can focus the ellipsis button, Space/Enter opens its menu, and menu items remain keyboard-focusable/selectable via standard dropdown keyboard behavior.
  - The trailing `actions` column uses the shared fixed width (`60px`) and the same right-edge button spacing used on Expenses/Incomes (`mr-[5px]` on the icon button).
  - If the grid is narrower than its container, assign all leftover width to the trailing `actions` column (do not distribute it across data columns).
  - Fields that support inline editing (for example Name) should be click-to-edit directly in-cell, rather than routed through an actions-menu rename flow.
  - Color swatch controls are treated as inputs: `h-7`, no extra margin, gray input border (`--grid-sticky-line`), standard input focus ring, keyboard/grid navigation focuses the swatch input without auto-opening the menu, and Space/Enter opens the swatch menu with focus landing on the selected swatch (or first swatch when none is selected).
  - New rows in a data-grid card are created from a `+` button in the card header that opens a modal form; do not use inline add rows above the grid.
  - Use column meta flags consistently: `containsEditableInput` for inline form controls, `containsButton` for button/menu cells, so shared grid padding and row-height rules are applied correctly.

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

## Shadows and Borders

- Borders: 1px, using `border` token
- Shadows: Only for elevated elements (dropdowns, modals, active tabs)
- No decorative box shadows on cards or sections

## Dark Mode

Full dark mode support via CSS variables. All semantic tokens have light and dark variants defined in `index.css`.
