## Why

The existing Babylon Airtable base tracks snake growth with manually maintained table formulas and record links. BathOS should replace that spreadsheet logic with a household-shared module that stores raw snake and weigh-in data while deriving growth progress automatically.

## What Changes

- Add a public `Snake` module at `/snake/...`.
- Add Drawers/Budget-style household setup, invite joining, and household member management for Snake.
- Add Garage-style snake entities so a household can manage one or more snakes from a config page and choose the current snake from the top navigation.
- Add a full-view weight-record grid for the current snake with editable raw fields and derived growth-rate, expectation, and growth-status fields.
- Add ball-python growth expectation bands as seeded module data.
- Import the current Babylon Airtable records for the admin user `art@bath.garden`.
- Register the Snake module in platform routing, launcher metadata, host-module detection, manifest output, docs, and Supabase types.

## Capabilities

### New Capabilities

- `snake-module`: Public Snake module behavior, including household sharing, snake entities, weight records, derived ball-python growth evaluation, and seeded Babylon data.

### Modified Capabilities

- None.

## Impact

- New module files under `src/modules/snake/`.
- Platform routing and module metadata updates in `src/App.tsx`, `src/platform/modules.ts`, `src/platform/hooks/useHostModule.ts`, and related tests.
- Shared household adapter type updates in `src/platform/households/`.
- Supabase migration adding `snake_` tables, RLS policies, household RPCs, and seed/import data.
- Generated Supabase type updates in `src/integrations/supabase/types.ts`.
- Documentation updates for the live module list.
