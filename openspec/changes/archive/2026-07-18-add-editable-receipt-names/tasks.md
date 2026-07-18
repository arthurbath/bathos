## 1. Receipt Name Data Contract

- [x] 1.1 Add and verify a Supabase migration that backfills a required non-blank receipt name while preserving original filenames and storage paths
- [x] 1.2 Update Garage and generated Supabase TypeScript types for receipt names
- [x] 1.3 Extend Garage servicing mutations to upload named receipts and persist edits to existing receipt names within the signed-in vehicle scope

## 2. Garage User Interface

- [x] 2.1 Default newly selected receipt names by removing the final filename extension and expose editable name controls for pending and existing receipts
- [x] 2.2 Display the comma-delimited receipt-name list in the Servicings grid with an appropriate default width

## 3. Verification

- [x] 3.1 Add focused tests for default-name derivation, editing pending and existing receipt names, mutation payloads, and grid display
- [x] 3.2 Run focused Garage tests, lint/build checks, Supabase validation, and OpenSpec validation
