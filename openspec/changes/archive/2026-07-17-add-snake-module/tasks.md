## 1. Database And Types

- [x] 1.1 Add a Supabase migration for Snake households, members, snakes, expectation ranges, weight records, RLS policies, household RPCs, grants, and guarded Babylon seed data.
- [x] 1.2 Update generated Supabase TypeScript types for the new Snake tables and RPCs.

## 2. Module Data Logic

- [x] 2.1 Add Snake module TypeScript types and growth calculation utilities with focused tests for previous-record selection, monthly growth rate, age bands, and growth-status formatting.
- [x] 2.2 Add Snake household, snake entity, expectation-range, and weight-record hooks using module-scoped Supabase queries and mutations.

## 3. Module UI

- [x] 3.1 Add Snake household setup using the shared household setup pattern.
- [x] 3.2 Add Snake shell/navigation with `/snake/weights` and `/snake/config`.
- [x] 3.3 Add Garage-style snake entity config with add/edit/delete modals and household management.
- [x] 3.4 Add weight-record DataGrid with add/edit/delete controls and derived growth columns.

## 4. Platform Registration

- [x] 4.1 Register Snake in routes, launcher metadata, module detection, app manifest, and tests.
- [x] 4.2 Update README/docs for the public Snake module.

## 5. Validation

- [x] 5.1 Run focused Snake/module tests.
- [x] 5.2 Run `npm run spec:validate`.
- [x] 5.3 Run broader BathOS validation appropriate to the touched surfaces.

## 6. Pattern Refinement

- [x] 6.1 Add Garage-style persisted current-snake selection.
- [x] 6.2 Convert Snake config rows to Garage-style inline editing with add/delete grid controls.
- [x] 6.3 Convert Snake weights to a full-view inline-editing DataGrid and remove the visible previous-record column.
