## 1. History Contract

- [x] 1.1 Add direction-aware undo and redo domain validation and transition types with focused tests
- [x] 1.2 Add a guarded redo repository operation and reconstruct a bounded 100-step undo and redo cursor from projected history
- [x] 1.3 Add and validate the Supabase migration that classifies exact snapshot inverses as undo or redo

## 2. Direct List Interactions

- [x] 2.1 Remove persistent Undo and selection buttons while wiring global platform undo and redo commands
- [x] 2.2 Implement Command-click or Control-click entry, ordinary selection toggles, and original-anchor Shift-click range replacement
- [x] 2.3 Add arbitrary-position drag reordering within supported Today, Anytime, and Someday scopes while retaining keyboard and menu alternatives

## 3. Discoverability and Coverage

- [x] 3.1 Present simultaneous Mac and Windows interaction-reference columns with current-platform identification
- [x] 3.2 Add focused hook, repository, shell, ordering, selection, keyboard, accessibility, and migration tests
- [x] 3.3 Verify the rendered desktop interaction flow in supported browsers and confirm the narrow mobile header remains overflow-free

## 4. Release and Closeout

- [x] 4.1 Run targeted Vitest coverage, `npm run test`, `npm run lint`, `npm run build`, `supabase test db`, and `openspec validate --all --strict`
- [x] 4.2 Obtain production migration approval, apply the migration, deploy the matching web release, and run the cleanup-backed production undo and redo projection gate
- [x] 4.3 Sync and archive the OpenSpec change, update affected Tasks readiness documentation, rerun full validation, commit, push main, and prove a clean synchronized repository
