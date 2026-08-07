## 1. Schema Compatibility

- [x] 1.1 Add hierarchy-history `action_id` and the versioned local action-journal table to the Tasks PowerSync schema
- [x] 1.2 Add startup schema compatibility assertions and safe empty-queue cache-generation replacement
- [x] 1.3 Add generated-schema and incompatible legacy-cache regression coverage

## 2. Local Action Journal

- [x] 2.1 Define and validate versioned semantic task and checklist action snapshots
- [x] 2.2 Implement local journal append, pruning, cursor reconstruction, redo invalidation, and 30-minute/100-action bounds
- [x] 2.3 Implement guarded task and checklist snapshot replay through existing local-first repositories
- [x] 2.4 Add journal persistence, expiry, offline replay, conflict, creation, and grouped-action tests

## 3. Unified Mutation Registration

- [x] 3.1 Replace task history reservations with complete before/after local action reservations and explicit grouping
- [x] 3.2 Upgrade checklist mutation notifications to carry complete versioned before/after action payloads
- [x] 3.3 Route Tasks shell, keyboard commands, pointer controls, and iOS shake through the one journal cursor
- [x] 3.4 Remove obsolete task/checklist projection polling, stream arbitration, and misleading failure-to-boundary fallback

## 4. Verification

- [x] 4.1 Add integration coverage for immediate checklist completion undo restoring completion and exact order in one action
- [x] 4.2 Add cross-entity chronological undo/redo, pending-edit flush, relaunch, and new-forward-action invalidation coverage
- [x] 4.3 Run focused Vitest suites plus full test, lint, build, and OpenSpec validation
- [ ] 4.4 After publication, verify the installed Mac cache has rotated from its confirmed legacy schema to the compatible generation without discarding its confirmed-empty upload queue
