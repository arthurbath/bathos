## Why

BathOS DataGrids already distinguish keyboard-focused cells from cells in editing mode, but a focused text-entry cell cannot currently accept spreadsheet-style paste. Users should be able to replace the complete value of a focused cell directly from the clipboard without first entering editing mode.

## What Changes

- Let focused, non-editing DataGrid text-entry cells accept the platform paste command.
- Replace the cell's complete value with the clipboard's plain-text content and commit through the cell's existing save, optimistic display, history, and focus-restoration behavior.
- Apply the interaction consistently to shared plain-text, longtext, number, URL, currency, and percentage grid cells.
- Preserve native insertion paste when a cell is already editing, and leave non-text-entry controls unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Extend the shared DataGrid focused-versus-editing contract with spreadsheet-style replacement paste for text-entry cells.

## Impact

- Shared component: `src/components/ui/data-grid.tsx`.
- Shared regression coverage: `src/components/ui/data-grid.focus.test.tsx`.
- Every BathOS module using the shared text-like DataGrid cell primitives inherits the behavior. No API, schema, dependency, or Supabase change is required.
