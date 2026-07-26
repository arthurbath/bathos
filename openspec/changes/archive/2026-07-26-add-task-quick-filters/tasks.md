## 1. Durable Preference

- [x] 1.1 Generate a migration adding constrained Tasks quick-filter value and timestamp columns to `bathos_user_settings`
- [x] 1.2 Preserve owner-only RLS for preference updates and update generated Supabase types
- [x] 1.3 Implement an owner-keyed cached preference hook with database, focus, online, and cross-tab reconciliation
- [x] 1.4 Cover default, invalid, newer-database, newer-cache, and persisted-change preference behavior

## 2. Filtering Domain

- [x] 2.1 Define the five supported filter values, labels, sanitizer, and actionability matching rules
- [x] 2.2 Cover actionable, non-actionable, Waiting, Rechecking, All Tasks, and invalid-value behavior

## 3. Tasks Interface

- [x] 3.1 Add the Quick Filters control to primary list action rows with inactive icon and active-name states
- [x] 3.2 Apply the active filter before grouping, rendering, focus traversal, and bulk selection
- [x] 3.3 Preserve project cards and deleted hierarchy roots, reconcile incompatible task interaction state, and show a filtered empty state
- [x] 3.4 Cover default, activation, replacement, clearing, cross-list persistence, selection reconciliation, and non-task-content behavior

## 4. Verification

- [x] 4.1 Run focused domain, preference, Tasks shell, migration, and RLS tests
- [x] 4.2 Run Tasks type checking, lint, production build, strict OpenSpec validation, Supabase lint, and diff checks
  - Supabase lint reached the pre-existing `move_drawers_unit_drawers_to_limbo` window-function error; the quick-filter migration applied locally, its columns/constraint/RLS were queried directly, and local schema diff reported no drift.
- [x] 4.3 Verify the control and all four filters in the running desktop app, retain responsive coverage in the complete Tasks suite, and restore All Tasks after acceptance
- [x] 4.4 Sync and archive the completed OpenSpec change
