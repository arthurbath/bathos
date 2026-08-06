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
- Do not add subtext beneath page, section, card, or modal headings unless explicitly requested in the task.

## UI Phrase Casing

Use Title Case for:

- Toast titles
- Button labels
- Input labels
- Input placeholders
- Module names
- Page titles
- Modal titles
- Card titles
- Dropdown menu options
- Section headings, including everything rendered as `h1` through `h6`
- Form modal headers should normally contain only the title. Do not add subtext beneath a modal heading unless the task explicitly calls for it.

Use sentence case for:

- Empty-state "No data" messages, including empty DataGrids, lists, searches, and collection buckets
- Toast message bodies

Use lowercase for these words when they appear in the middle of a label:
`a`, `an`, `and`, `as`, `at`, `by`, `for`, `from`, `if`, `in`, `n` (for "and"), `o` (for "of"), `of`, `on`, `or`, `tha` (for "the"), `the`, `to`, `wit` (for "with"), `with`.

Capitalize the first and last lexical words in a title-case phrase even when either word appears in the lowercase list. Capitalize major words and each major part of a hyphenated compound. Preserve proper nouns, acronyms, and canonical product spellings such as `BathOS`, `macOS`, `iOS`, `PowerSync`, `DataGrid`, `CSV`, and `URL`.

Apply casing only to system-authored framing. Never change the capitalization of a user-authored task, project, area, household, vehicle, wardrobe item, drawer, snake, budget value, or other stored value merely because it appears inside a governed UI phrase.

A system-authored accessible name or tooltip title that labels a button or input follows the title-case control-label rule. Descriptive accessibility prose that communicates state or instructions uses sentence case.

## Toast Notifications

- Shared BathOS toast services calculate automatic dismissal timing from the amount of readable text rather than using a fixed duration.
- Estimate one visible mobile line for each 42 characters in the title and message body. Count the title and message body as separate text blocks, and count explicit line breaks separately.
- Each estimated line contributes 1,000 ms to the display duration. Every toast remains visible for at least 1,000 ms.
- Modules should provide the toast content and rely on the shared timing policy. Do not add local duration overrides for routine notifications.
- Preserve manual dismissal and the toast renderer's normal pause and interaction behavior.
- Layer toast notifications above fixed in-content action surfaces, including the Tasks selection-mode bar, while keeping shared mobile navigation above the toast stack.

## Icons

- All iconography uses Lucide React (`lucide-react`)
- Icons are inline SVGs — no image files, no emoji
- Use sparingly. Not every element needs an icon.
- Use Lucide `ExternalLink` for generic actions that open an external destination. Use Lucide `Link2` when the icon identifies a generic stored link rather than the action of leaving the current context. Preserve an established protocol-specific icon, such as Mail, when that protocol communicates more useful meaning than a generic link glyph. Native platform surfaces use the closest system rendering of the same concept.

## Input Decorations

- Shared single-line Inputs, Select triggers, and date-picker triggers may include an optional leading Lucide decoration when a compact context does not use visible labels.
- Decorations identify the control's concept. They are muted, noninteractive, hidden from assistive technology, and never replace the control's programmatic name or useful placeholder.
- Shared controls reserve a fixed leading content area for decorations. Long values may truncate, clip, or scroll inside the remaining content area, but must never render underneath or displace the decoration.
- Decoration support is shared, but modules adopt it intentionally. A decoration is not required on every control.
- Ordinary non-DataGrid text inputs, textareas, selects, date triggers, and composite input groups use the shared solid muted-gray `--input` outline at rest. The focus border and ring remain brighter and must not change the control's dimensions. DataGrid editors retain their borderless-until-focused convention.

## Spacing and Sizing

- Consistent use of Tailwind spacing scale
- Mobile-first responsive design
- Max content width: `max-w-5xl` for data views, `max-w-lg` for forms
- Cards use standard `Card` component with minimal padding

## Buttons

- Use the shared `ghost` variant as the canonical Borderless button treatment for low-noise actions that should inherit the surface behind them.
- Borderless buttons rest with a transparent border and background while retaining the shared keyboard-focus border and ring without changing size.
- Use the user-facing label **Borderless** when presenting this variant in component showcases or design guidance.

## Select Controls

- Use the shared BathOS `Select` component from `src/components/ui/select.tsx` for every new ordinary single-selection dropdown.
- Use its standard `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` parts so styling, focus, keyboard traversal, and popover behavior remain consistent.
- Do not add native `<select>` elements or locally styled dropdown substitutes unless a documented specialized platform, accessibility, DataGrid, or input-mode requirement cannot be met by the shared Select.
- A specialized exception must be explicit in the governing task or durable specification rather than inferred from convenience.

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
  - Use a trailing `actions` column with a Borderless ellipsis trigger (`MoreHorizontal`, shared `ghost` button variant) and row actions in a dropdown menu.
  - Actions triggers participate in grid keyboard navigation: arrow/tab can focus the ellipsis button, Space/Enter opens its menu, and menu items remain keyboard-focusable/selectable via standard dropdown keyboard behavior.
  - The trailing `actions` column uses the shared fixed width (`40px`) and the same right-edge button spacing used on Expenses/Incomes (`mr-[5px]` on the icon button).
  - If the grid is narrower than its container, assign all leftover width to the trailing `actions` column (do not distribute it across data columns).
  - Fields that support inline editing (for example Name) should be click-to-edit directly in-cell, rather than routed through an actions-menu rename flow.
  - Keyboard navigation and save behavior must use the shared `DataGrid` focus-restoration path. On blur/commit, the grid must not introduce extra scroll movement beyond what is required to keep the focused cell fully visible.
  - When moving focus by Tab/Shift+Tab or arrow keys, the target cell must be scrolled fully into view, accounting for sticky headers, sticky grouped rows, sticky footers, and pinned left/right columns. A cell must never remain partially hidden beneath sticky grid chrome.
  - Focus restoration after async saves must wait until the target control is focusable again before scrolling. Do not add module-specific blur/save scroll hacks on top of the shared grid behavior.
  - Delete/backspace resets are part of the shared grid keyboard contract. A focused grid control should only reset on `Delete`/`Backspace` when that control explicitly opts in with a shared grid reset target.
  - Required fields must not infer a reset target from control type alone. If empty string, `0`, or null is not valid for that field, the delete/backspace key must do nothing.
  - Nullable text fields should opt in to reset to `''`.
  - Nullable numeric fields should opt in to reset to `''`.
  - Required numeric fields that allow zero should opt in to reset to `'0'`.
  - Checkbox fields should opt in to reset to unchecked.
  - Select fields should use the shared select-trigger helper and only opt in when the menu exposes a true null/none option (for example `_none` rendered as `—` or `None`).
  - Color swatch controls are treated as inputs: `h-7`, no extra margin, gray input border (`--grid-sticky-line`), standard input focus ring, keyboard/grid navigation focuses the swatch input without auto-opening the menu, and Space/Enter opens the swatch menu with focus landing on the selected swatch (or first swatch when none is selected).
  - New rows in a data-grid card are created from a `+` button in the card header that opens a modal form; do not use inline add rows above the grid.
  - The standard DataGrid add button style is the compact green outline icon button used by Budget Expenses/Incomes: `variant="outline-success"`, `size="sm"`, `className="h-8 w-8 p-0"`, with a `Plus` icon and an `aria-label`.
  - Required fields in DataGrid add/edit modals show a red asterisk immediately to the right of the field label. If the confirm action is disabled until required fields are complete, do not show required-field validation text on initial modal open; reserve inline validation messages for actionable problems such as duplicates, invalid formats, or failed submit attempts.
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

## Form Control Interaction

All ordinary forms, in-page form scopes, and form-style modals follow one keyboard interaction model:

- Text, number, email, password, URL, and time fields edit natively whenever focused. They do not have separate focused and editing modes outside a DataGrid.
- Tab moves to the next enabled visible control in DOM order. Shift+Tab moves backward. Modal traversal wraps inside the modal.
- Unmodified Return in an ordinary single-line text field submits the nearest form by default. Textareas retain multiline Return, composite fields retain their owned Return behavior, and exceptional forms may explicitly opt out.
- Textareas preserve native Return newline behavior.
- Buttons, button-like composite triggers, and static links activate with Space or Return. Checkboxes and switches toggle with Space or Return and retain focus.
- Mac form commands are Command+Return to submit and Command+Escape to cancel. Windows form commands are Control+Return to submit and Control+Shift+X to cancel.
- Form commands act on the nearest form or declared form scope. Native forms submit through `requestSubmit()` so validation remains authoritative.
- Plain Escape is field-local. It may close and revert the deepest open select, date picker, color picker, or similar field layer, but it does not cancel a form or close a modal.
- A draft form's visible Cancel or Close action defines its cancel semantics. An autosaving form flushes accepted changes and closes without claiming to revert persisted work.
- Gateway login, signup, password-recovery, password-reset, and household-entry forms use the default Return submission behavior.

Composite controls follow these additional rules:

- A closed select opens with Space or Return. Arrow keys navigate its options, Space or Return commits, Escape cancels, and Tab/Shift+Tab commit the current accepted state and move to the adjacent form control.
- A staged multi-select commits with Return or Tab. Escape restores the state that existed when it opened.
- Date fields use the shared `DatePickerField` button-plus-calendar popover. Space or Return opens it. Arrow keys traverse enabled calendar controls. Space or Return activates the focused action. Escape cancels and restores trigger focus.
- The internal controls of an open date picker are not separate Tab stops in the containing form. Tab or Shift+Tab closes the picker without selecting a merely focused date and moves to the next or previous form control.
- File inputs retain native browser selection and security behavior.
- Custom color controls open with Space or Return, use arrows for palette traversal, commit with Space or Return, cancel with Escape, and commit-and-exit with Tab.
- Delete or Backspace resets a checkbox or switch to off, clears a closed multi-select, and resets a select or date only when that control declares a legal reset target.

DataGrid text-entry cells intentionally use a spreadsheet interaction model:

- Keyboard traversal focuses a text-entry cell without starting editing. Pointer activation starts editing at the chosen insertion point.
- Return starts editing at the end of the current value. A second Return commits and returns to focused mode.
- Printable input from focused mode replaces the complete value and starts editing.
- Paste from focused mode replaces and immediately commits the complete value, retains keyboard focus, and does not enter editing. Paste while editing retains native insertion and text-selection behavior.
- Escape while editing restores the value that existed when editing began.
- Arrow keys move spatially only in focused mode. While editing, every arrow key retains native cursor and selection behavior, including at the beginning and end of the text.
- Tab and Shift+Tab commit, move horizontally, wrap across rows, skip unavailable controls, and leave the grid through native browser traversal at the outer boundaries.
- Delete and Backspace reset a focused non-editing cell only when the caller declares a legal reset target. Never infer a select reset from its first option.

This is the standing standard for all new and updated BathOS controls.

## Content Selection and Native Dragging

- Ordinary BathOS application chrome, controls, headings, labels, static values, and read-only user content are not text-selectable.
- Inputs, textareas, and active contenteditable editors preserve native text selection.
- A DataGrid cell's displayed value is not selectable while the cell is focused but not being edited. Its text becomes selectable when the cell enters edit mode.
- Legal documents and other deliberately document-like surfaces opt into selection with `data-bathos-text-selection="allow"`.
- Links and images do not use browser-native dragging unless a surface deliberately opts in with `data-bathos-native-drag="allow"`.
- Application-owned drag interactions, including Tasks task dragging, DataGrid column resizing, and file drop targets, remain available.
- The selection policy must not interfere with keyboard focus, screen readers, browser Find, link activation, or modified-click behavior.

## Tooltip Interaction

For dotted-underline tooltip text triggers, use the persistent interaction model:

- Keyboard focus, tap, or click opens the tooltip. Pointer hover alone does not.
- Repeated taps/clicks on the same trigger do not dismiss it.
- Tooltip closes when focus leaves the trigger or when the user taps/clicks elsewhere in the UI.

## Hover-Independent Interaction

- BathOS does not change control color, opacity, border, decoration, transform, or visibility solely because a pointer hovers it.
- Focus-visible, pressed, open, selected, checked, disabled, invalid, saving, and other semantic states remain visible.
- An action or essential explanation must never be available only on hover. Present it persistently or behind a deliberate click, tap, keyboard, or assistive-technology action.
- Remove a former hover disclosure when it only duplicates an action or fact already clear in the same context.

## Link Navigation Convention

- In-app navigation links must behave like normal links for modified clicks:
  - CMD/CTRL-click and middle-click open in a new tab.
  - Plain left click uses client-side navigation.
- Implement navigational UI using real anchors (`<a href="...">`) and intercept only plain left clicks for SPA routing.

## Installed Module Shell

- The platform topnav appears in ordinary web browsing and is hidden in standalone PWAs and native module hosts.
- Installed modules preserve safe-area clearance and their complete module navigation.
- Account, Feedback, and Sign Out appear in an Account card at the bottom of the module's Config view only while installed.
- Header-only module controls require an in-page installed placement.
- An installed module contains only its own module and required Account/authentication routes.
- Links to another BathOS module, the platform launcher, an external website, or a non-web protocol open through the device browser or operating system.
- A module without an ordinary Config view may expose an installed-only Config destination for the Account card. Do not show that destination in ordinary web navigation.

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
