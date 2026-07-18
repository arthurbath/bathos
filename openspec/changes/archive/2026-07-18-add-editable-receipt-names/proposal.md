## Why

Garage receipts currently expose only the uploaded filename and Servicings reduces them to a count, making individual receipts hard to identify at a glance. Users need a human-readable receipt name that starts from the uploaded filename but remains editable without renaming the stored file.

## What Changes

- Store a user-editable name for each Garage servicing receipt while preserving the original uploaded filename and storage object path.
- Default each new receipt name to its uploaded filename with the final extension removed.
- Let users edit receipt names in the servicing form for both newly selected files and previously uploaded receipts.
- Show receipt names as a comma-delimited list in the Servicings grid instead of showing only the receipt count.

## Capabilities

### New Capabilities

- `garage-receipt-names`: Defines defaulting, editing, persistence, and Servicings-grid display behavior for Garage receipt names.

### Modified Capabilities

None.

## Impact

- Garage module types, servicing form state, receipt upload/update mutations, and Servicings DataGrid rendering.
- `garage_servicing_receipts` gains a required receipt-name column with a backfill for existing rows.
- Generated Supabase TypeScript types and focused Garage component/data-layer tests.
