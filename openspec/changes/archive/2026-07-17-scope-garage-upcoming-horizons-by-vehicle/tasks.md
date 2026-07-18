## 1. Database And Types

- [x] 1.1 Create a Supabase migration that adds constrained vehicle horizon columns, backfills existing account values, and removes `garage_user_settings`
- [x] 1.2 Update generated Supabase table types and Garage domain types for vehicle-level horizons

## 2. Garage Data And Due Logic

- [x] 2.1 Simplify the vehicle hook to load and mutate vehicle-level horizon values without account settings
- [x] 2.2 Make due calculation and `useGarageDue` consume the selected vehicle's horizons directly

## 3. Vehicle Configuration

- [x] 3.1 Remove the account-level thresholds card and settings mutation path from the Garage shell
- [x] 3.2 Add editable Upcoming Miles and Upcoming Months fields to the Vehicles DataGrid with shared width persistence
- [x] 3.3 Add vehicle horizon fields and defaults to the Add Vehicle modal and creation payload

## 4. Tests

- [x] 4.1 Update due-math tests to verify different vehicle horizons and zero-horizon behavior
- [x] 4.2 Update Garage Config tests for vehicle-level display, inline edits, and add-form values

## 5. Validation And Specification

- [x] 5.1 Run targeted Garage tests, the full Vitest suite, lint, and production build
- [x] 5.2 Verify the Supabase migration against a local database and inspect migration status or document an unavailable local runtime
- [x] 5.3 Run `npm run spec:validate` and `openspec validate --all --strict`
- [x] 5.4 Sync and archive the completed OpenSpec change so the durable Garage specification is current
