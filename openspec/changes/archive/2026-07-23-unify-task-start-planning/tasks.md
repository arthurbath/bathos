## 1. Database Contracts

- [x] 1.1 Add a migration that preserves explicitly cleared Primary Links and presence-aware export normalization
- [x] 1.2 Extend reminder save, normalization, and root-rebind functions to use a future Start Date or Today planning date
- [x] 1.3 Add database tests for Mail-link clearing, Today reminders, future reminders, rebind, activation, and complete Start clearing

## 2. Start Picker

- [x] 2.1 Add opt-in shared Calendar Tab traversal without changing existing date-picker behavior
- [x] 2.2 Build the Tasks Start picker from shared popover, calendar, input, button, semantic token, and Lucide primitives
- [x] 2.3 Replace separate editor temporal fields with the unified autosaving Start picker and preserve draft behavior
- [x] 2.4 Make reminder and Start keyboard commands open the picker with correct focus

## 3. Task Actions

- [x] 3.1 Split Move, Do, and Start row-menu surfaces and remove Cancel, Move Up, and Move Down menu actions
- [x] 3.2 Preserve drag ordering, keyboard ordering, deletion, focus restoration, undo, and redo behavior
- [x] 3.3 Add regression coverage for exact menu actions and Primary Link clearing through editor close and reopen

## 4. Verification And Release

- [x] 4.1 Run targeted unit, integration, database, accessibility, and keyboard tests
- [x] 4.2 Perform screenshot-grounded rendered QA for desktop and mobile Start picker states and record `design-qa.md`
- [x] 4.3 Run full tests, lint, build, database lint/tests, and OpenSpec validation
- [x] 4.4 Refresh the private production backup, apply the approved migration and web release, run and clean the owner-scoped acceptance fixture, and reconcile PowerSync
- [x] 4.5 Sync durable specs, archive the change, commit and push `main`, and prove repository and production parity
