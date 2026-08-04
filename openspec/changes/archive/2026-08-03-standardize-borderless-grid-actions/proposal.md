## Why

BathOS already uses visually borderless buttons successfully, but the style is not presented as an explicit design-system option and DataGrid action buttons still add unnecessary outlined boxes to every row. Establishing the existing ghost treatment as the canonical Borderless button reduces grid noise while preserving focus visibility and keyboard behavior.

## What Changes

- Present the shared `ghost` button variant as the user-facing Borderless button type in the Admin UI Testing showcase, including its disabled state.
- Render trailing DataGrid ellipsis action triggers with the shared Borderless button variant instead of the Outline variant.
- Preserve the existing DataGrid action-column size, spacing, accessible names, keyboard traversal, focus treatment, and dropdown behavior.
- Document the Borderless button and DataGrid action-trigger convention in the BathOS style guide.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Define the canonical Borderless button treatment and require it for DataGrid row-action ellipsis triggers.

## Impact

- Shared UI primitive and Admin showcase: `src/components/ui/button.tsx` and `src/platform/components/AdminPage.tsx`.
- DataGrid consumers across Budget, Garage, Snake, Tasks settings, and Wardrobe.
- Durable design guidance in `docs/human/STYLE_GUIDE.md` and the platform visual foundations specification.
- No database, Supabase, native-companion, dependency, or API changes.
