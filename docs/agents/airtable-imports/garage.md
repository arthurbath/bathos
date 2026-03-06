# Garage Airtable Import Archive

This document archives the one-off Garage Airtable import script that was previously kept at `scripts/garage-airtable-import.mjs`.

The script is no longer needed for BathOS Garage, but the import approach may be useful for future modules that need one-time Airtable migrations.

## What the script did

- Read Airtable records from two tables: `Services` and `Servicings`
- Resolved a BathOS user by email through the Supabase Admin API
- Created a target vehicle if one did not already exist for that user
- Inserted `garage_services`
- Inserted `garage_servicings`
- Inserted join rows into `garage_servicing_services`
- Supported `--dry-run` to print a migration summary without writing data

## Reusable import pattern

For future Airtable imports, the reusable structure was:

1. Parse CLI args for a target user/entity and optional `--dry-run`.
2. Read required Airtable and Supabase credentials from environment variables.
3. Fetch Airtable pages until no `offset` remains.
4. Normalize Airtable records into explicit BathOS row shapes before writing.
5. Resolve target BathOS user or group up front.
6. Insert parent rows first, then child rows, then join rows.
7. Keep a source-ID to inserted-ID map when relationships depend on Airtable record IDs.
8. Print a machine-readable summary for dry runs and completed imports.

## Garage-specific mapping

The removed script used this service-type mapping:

| Airtable `Type` | BathOS `garage_services.type` |
|---|---|
| `Replacement` | `replacement` |
| `Clean/Lube` | `clean_lube` |
| `Adjustment` | `adjustment` |
| `Check` | `check` |

It also mapped servicing outcomes as:

- `Affirmed Not Needed` -> `not_needed_yet`
- `Rendered` -> `performed`

## Garage-specific assumptions

These details were hard-coded for a single historical import and should not be copied blindly:

- Vehicle defaulted to `Bike`
- New vehicle creation used:
  - `make: Mission Bicycles`
  - `model: Sutro`
  - `model_year: 2016`
  - `current_odometer_miles: 0`
- Service cadence imported only `Every (Months)` and ignored mileage cadence
- Receipt attachments were counted in summaries but not imported
- Servicings defaulted `odometer_miles` to `0`

## Notes for future Airtable imports

- Treat Airtable field names as unstable external schema. Normalize into local constants early.
- Fail fast on unmapped enum values rather than silently guessing.
- Keep dry-run output concise and JSON-formatted.
- Prefer module-specific scripts only while an import is active. After the migration is done, archive the mapping notes in `docs/agents/`.
