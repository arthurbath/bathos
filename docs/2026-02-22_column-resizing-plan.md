# Column Resizing Plan (Budget Data Grids)

Date: 2026-02-22
Owner: Codex
Scope: Budget module data grids (`Expenses`, `Incomes`)

## Objective

Add user-resizable grid columns with these rules:

- Widths are constrained to 20px increments.
- Minimum width is 60px for every resizable column.
- Resizing is continuous while dragging.
- Persist to DB only when drag ends.
- Preferences are user-level only (not household-level).
- The ellipsis/actions column is fixed and not resizable.
- Defaults are defined per existing grid column.

## Confirmed Product Decisions

1. Persist in `bathos_user_settings`.
2. Width prefs are per user, shared across all households for that user.
3. One preference set per grid (`expenses`, `incomes`), no per-view-mode split.
4. Resize should update continuously while dragging.
5. DB writes only on drag end.
6. Only ellipsis/actions column is non-resizable.
7. Hard min width of 60px for all resizable columns.
8. Overflow behavior should truncate/cut off on the right.
9. Default widths approved (below).

## Default Width Map (px)

All values are multiples of 20.

### Expenses grid

- `name`: 240
- `category`: 220
- `amount`: 120
- `estimate`: 80
- `frequency`: 220
- `monthly`: 120
- `payment_method`: 240
- `payer`: 140
- `benefit_x`: 120
- `benefit_y`: 120
- `fair_x`: 120
- `fair_y`: 120
- `actions`: 60 (fixed, non-resizable)

### Incomes grid

- `name`: 240
- `partner_label`: 200
- `amount`: 120
- `frequency_type`: 220
- `monthly`: 120
- `actions`: 60 (fixed, non-resizable)

## Technical Design

## 1) Persistence model in `bathos_user_settings`

Add a new JSONB column to store widths:

- Column: `grid_column_widths jsonb not null default '{}'::jsonb`

Proposed shape:

```json
{
  "expenses": {
    "name": 240,
    "category": 220,
    "amount": 120
  },
  "incomes": {
    "name": 240,
    "partner_label": 200
  }
}
```

Rationale:

- No new table required.
- Existing RLS already scopes row access to `auth.uid() = user_id`.
- Supports future modules/grids without schema churn.

## 2) Column sizing in TanStack Table

Move from CSS-only width hints to TanStack sizing state:

- Enable column resizing in table config.
- Use `columnResizeMode: 'onChange'` for continuous feedback.
- Define `size` and `minSize` per column.
- Set actions column to fixed (`enableResizing: false`, `size: 60`, `minSize: 60`, `maxSize: 60`).

Snap-to-grid rule:

- Any user-driven width update is normalized to:
  - `snapped = max(60, round(raw / 20) * 20)`
- Apply normalization during resize state updates so drag remains continuous but constrained.

## 3) Shared grid infrastructure updates (`DataGrid`)

Update header rendering to include a resize handle between columns:

- Handle visible on resizable headers only.
- Cursor: horizontal resize (`cursor-col-resize`).
- Use TanStack resize handlers on mouse/touch events.
- Prevent header sort toggle when interacting with handle.

Width application:

- Render header/cell width from `column.getSize()`.
- Keep horizontal overflow scrolling behavior.
- Ensure sticky first column still aligns with resized widths.

Overflow behavior:

- Add truncation/cutoff-friendly classes in header/cell wrappers where needed (`overflow-hidden`, `whitespace-nowrap`, `text-ellipsis`).
- Inputs remain editable; clipped content on the right is acceptable per decision.

## 4) Per-grid state and DB sync

In `ExpensesTab` and `IncomesTab`:

- Initialize column sizing state from:
  - DB user setting (if exists), else
  - approved defaults.
- Keep local sizing state for immediate UI updates.
- Track resize lifecycle via `columnSizingInfo.isResizingColumn`.
- Persist only on transition from resizing -> not resizing.
- Persist an upsert/update into `bathos_user_settings.grid_column_widths`.

Conflict behavior:

- Last write wins.
- No household dimension in payload.

## 5) Type and schema updates

Files to update:

- New migration in `supabase/migrations/` for `grid_column_widths`.
- Supabase TS types in `src/integrations/supabase/types.ts` to include new field.

## Implementation Steps

1. Add migration for `bathos_user_settings.grid_column_widths`.
2. Update generated/checked-in Supabase types.
3. Add shared width utilities:
   - snap-to-20 helper
   - default width maps
   - payload sanitization (drop unknown columns, enforce min/increment).
4. Add user settings read/write hook for grid widths.
5. Wire `ExpensesTab` column defs to explicit `id`, `size`, `minSize`, `enableResizing`.
6. Wire `IncomesTab` column defs similarly.
7. Update `DataGrid` header/cell render logic with handles + applied width styles.
8. Add truncation classes where required.
9. Verify sticky header/first-column/footer/group rows still align after resizing.
10. Run tests + lint and fix regressions.

## Testing Plan

Automated:

- Unit test: snap helper enforces increment and min width.
- Unit test: sanitization preserves fixed actions column width.
- Component-level tests (where practical): handle presence for resizable columns, absence for actions column.

Manual QA:

1. Resize multiple columns in Expenses and Incomes; ensure 20px snapping.
2. Confirm 60px hard minimum for every resizable column.
3. Confirm actions column cannot be resized.
4. Confirm width changes are visible during drag.
5. Confirm DB write occurs on drag end only.
6. Refresh page and confirm widths restore.
7. Sign into a second browser session as same user and confirm widths restore.
8. Sign in as different user in same household and confirm independent widths.
9. Verify sort interactions still work and are not hijacked by resize handle.
10. Verify mobile and desktop horizontal scrolling/visibility remains usable.

## Risks and Mitigations

- Risk: Sort click conflicts with resize handle.
  - Mitigation: stop propagation + dedicated handle target for resize events.
- Risk: Width mismatch in grouped/footer rows.
  - Mitigation: validate visual alignment in both grouped and ungrouped states.
- Risk: Too-frequent writes if resize end detection is wrong.
  - Mitigation: persist only on resizing-state transition; guard duplicate payload writes.

## Out of Scope (for this change)

- Double-click auto-fit.
- Keyboard-based column resizing.
- Column reorder/hide.
- Per-household or per-device width overrides.

