## Context

BathOS currently has household-sharing patterns in Budget and Drawers, and entity/config patterns in Garage. The Babylon Airtable base uses three tables: snake facts, ball-python growth expectation ranges, and monthly weight records. Airtable required explicit previous-record links and formulas, but BathOS can derive those values from sorted records and persisted snake metadata.

## Goals / Non-Goals

**Goals:**

- Add a public Snake module using the `snake_` namespace and `/snake/...` routes.
- Reuse the Drawers/Budget household concept so co-owners can join the same Snake household by invite code.
- Reuse the Garage entity/config pattern so a household can define one or more snakes and select the active snake for records.
- Store only canonical raw facts for weigh-ins and derive previous record, days since previous record, grams changed, grams per month, age in months, expected range, and growth status in application logic.
- Seed ball-python expectation bands and import the Babylon Airtable records for `art@bath.garden` when that user exists.

**Non-Goals:**

- Feeding, enclosure, shedding, health, or species-specific modules beyond ball-python weight tracking.
- Cross-module household sharing. Snake households remain module-specific.
- Admin-only gating. Snake is a normal launcher module for authenticated users.
- A charting/dashboard layer beyond the initial data grid and config surfaces.

## Decisions

- Use module-specific Snake households instead of reusing Drawers/Budget household tables.
  - Rationale: BathOS module isolation requires each module group entity to be independently removable.
  - Alternative considered: central household tables. Rejected because existing module guidance says group IDs are module-specific.

- Model snakes as first-class entities under a household.
  - Rationale: This matches Garage vehicles and supports multiple snakes without changing the weight-record shape later.
  - Alternative considered: one household equals one snake. Rejected because the user explicitly wants one or more snakes.

- Derive growth analytics client-side from raw records, snake birthday, and expectation ranges.
  - Rationale: Previous record is deterministic by snake and date. Storing it would recreate Airtable maintenance burden and create consistency risk.
  - Alternative considered: generated SQL view/RPC. Deferred because the initial UI can derive efficiently from small household datasets and avoid an extra API surface.

- Store species/profile as snake metadata and seed ball-python expectation ranges in a reference table.
  - Rationale: Initial behavior is ball-python-specific, but the data model should allow future species or profile expansion.
  - Alternative considered: hard-coded constants only. Rejected because the Airtable source has explicit expectation data and future species support is likely.

- Keep the first weigh-in's previous-record analytics blank.
  - Rationale: There is no prior record to compare against. Airtable showed a `NaN` growth rate for the first record, which should not be reproduced as user-facing BathOS output.

- Format growth status from the rounded monthly gap.
  - Rationale: Airtable displays strings such as `38 g/mo Below Expectations` and `Within Expectations`. The derived gap should round to the nearest whole gram per month.

## Risks / Trade-offs

- Seed user not found during migration -> The import block will skip the personal Babylon seed if `art@bath.garden` is not present, while still creating the module schema and expectation ranges.
- Client-derived analytics can drift if multiple code paths reimplement formulas -> Keep the calculations in one module-local library and cover them with focused tests.
- Household-management RPCs duplicate Drawers/Budget patterns -> Reuse the shared platform adapter and keep SQL shape parallel to Drawers to reduce risk.
- Route and manifest changes touch platform surfaces -> Add focused module metadata tests and run full validation.

## Migration Plan

- Add a Supabase migration that creates `snake_households`, `snake_household_members`, `snake_snakes`, `snake_growth_expectation_ranges`, and `snake_weight_records`, plus a follow-up `snake_snakes.is_active` flag for current-snake selection.
- Add RLS policies and SECURITY DEFINER RPCs for household creation, joining, listing, invite rotation, member removal, leaving, and deletion.
- Insert ball-python growth expectation rows.
- In a guarded `DO` block, find `auth.users.email = 'art@bath.garden'`, create a Snake household, insert `Babylon` with birthday `2024-11-27`, add the user as a member, and insert the 17 Airtable weight records.
- Rollback is standard migration rollback for local development. In production, removing the module would require a retirement migration that drops `snake_` objects and removes live module surfaces.
