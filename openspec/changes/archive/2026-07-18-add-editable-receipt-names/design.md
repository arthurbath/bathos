## Context

Garage servicing receipts currently store the original upload filename and storage path. The servicing form lists that filename, while the Servicings grid shows only the number of related receipts. Receipt names must become editable metadata without changing storage object identity or losing the original filename needed for file context.

## Goals / Non-Goals

**Goals:**

- Add durable, user-editable receipt names for existing and future Garage receipts.
- Preserve original filenames, storage paths, receipt ordering, ownership, and RLS behavior.
- Support editing names for pending uploads and persisted receipts in the existing servicing form.
- Render receipt names directly in the Servicings grid.

**Non-Goals:**

- Renaming or moving objects in Supabase Storage.
- Extending Garage MCP receipt upload/download behavior.
- Adding receipt search, sorting, or a separate receipt-management view.

## Decisions

### Store the user-facing name separately from the original filename

Add a required `name` column to `garage_servicing_receipts`. Keep `filename` as immutable upload metadata and `storage_object_path` as storage identity. This avoids fragile storage moves and allows display names to change independently.

An alternative was to repurpose `filename`, but that would erase the original uploaded filename and blur the distinction between user-facing metadata and file metadata.

### Backfill and default names by removing only the final extension

The migration backfills `name` from `filename` by removing the final dot-delimited extension, falling back to the full filename when removal would produce an empty value. The client applies the same rule when files are selected, so users see the eventual default before saving.

Removing only the final extension preserves meaningful compound names such as `invoice.final.pdf` as `invoice.final`. Removing all suffixes would be surprising and ambiguous.

### Save receipt metadata with the servicing form

Pending uploads carry both the `File` and editable name. Existing receipt edits are sent as scoped receipt update rows when the servicing is saved. Receipt updates use the existing authenticated client and ownership filters, leaving current RLS policies unchanged.

Immediate per-keystroke persistence was rejected because it would make Cancel misleading and create many unnecessary mutations.

### Keep the Receipts grid cell as the form entry point

The Receipts cell remains a button that opens the servicing form, but its visible text becomes the comma-delimited receipt-name list. Names follow the existing receipt creation order returned by the query.

## Risks / Trade-offs

- [Long receipt-name lists can exceed the current column width] → Increase the default width and truncate visually while retaining the full list as the element title.
- [A receipt update could target another user's row] → Preserve both receipt ID and current user/vehicle ownership filters—existing RLS remains the final enforcement layer.
- [A partial multi-step save could update servicing data before a receipt mutation fails] → Keep current error reporting and query invalidation behavior—each receipt metadata operation is idempotent on retry.

## Migration Plan

1. Add nullable `name`, backfill existing receipt rows from `filename`, then set the column `NOT NULL` and add a non-blank check constraint.
2. Regenerate or update the checked-in Supabase TypeScript types.
3. Deploy the migration before deploying UI code that selects and writes `name`.

Rollback requires removing UI dependencies on `name` first, then dropping the check constraint and column. Stored receipt files and original filenames remain unaffected.

## Open Questions

None.
