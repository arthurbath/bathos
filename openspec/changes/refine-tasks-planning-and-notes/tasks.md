## 1. Planning derivation and ordering

- [x] 1.1 Add one tested domain utility for Upcoming controlling dates, chronological ordering, and day, month, and year group labels
- [x] 1.2 Extend task and project list derivation so Upcoming includes future starts or deadline fallbacks while Anytime retains absent, present, and past starts
- [x] 1.3 Render Upcoming in stable date groups and preserve leading future-horizon indicators
- [x] 1.4 Permit direct Today drag across visible horizons by committing the target horizon and fractional order together while keeping non-pointer reordering section-bounded

## 2. List presentation and lifecycle feedback

- [x] 2.1 Replace Inbox and Next horizon iconography and render yellow leading Today-membership markers in Anytime
- [x] 2.2 Swap task completion controls to squares and bulk-selection controls to circles with accurate accessible names
- [x] 2.3 Add a brief reduced-motion-aware collapse and fade before complete or cancel mutations, including duplicate-action prevention and failure restoration

## 3. Notes reading and editing

- [x] 3.1 Add the narrowly scoped Markdown extension dependency and a safe full-content Markdown notes renderer
- [x] 3.2 Add preview and edit states with an auto-growing plain-text textarea, complete keyboard access, and safe real links
- [x] 3.3 Cover metadata inline code, prose, wrapped asterisk bullets, long HTTP links, non-HTTP source text, and disallowed protocols with component tests based on the supplied screenshot

## 4. Projection-safe undo and redo

- [x] 4.1 Rebuild the bounded history cursor from each complete projected slice instead of applying incrementally observed rows
- [x] 4.2 Gate undo and redo on the cursor-tip task's exact currently projected snapshot without skipping older history
- [x] 4.3 Add regression tests for out-of-order projection hydration, temporary task/history skew, deep traversal, redo invalidation, and safe convergence
- [x] 4.4 Run a local or disposable production acceptance fixture to confirm whether any database-side history migration is required

## 5. Documentation and local verification

- [ ] 5.1 Update the Tasks human guide and readiness evidence for the refined planning, notes, lifecycle, and history behavior
- [x] 5.2 Run focused tests, the full test suite, lint, production build, strict OpenSpec validation, and database tests if schema changes are introduced
- [x] 5.3 Verify desktop and mobile rendered behavior with the Browser plugin, including cross-horizon drag, Upcoming boundaries, notes wrapping and links, terminal motion, reduced motion, and console health

## 6. Release and closeout

- [x] 6.1 Obtain explicit approval for any required production migration and the matching Tasks web release
- [ ] 6.2 Apply approved production changes, run and clean up disposable acceptance data, and prove PowerSync and user-facing convergence
- [ ] 6.3 Sync the delta spec, archive the OpenSpec change, update final readiness evidence, and rerun full validation
- [ ] 6.4 Commit and push main, then prove the worktree, remote history, production release, database, and OpenSpec state are clean and synchronized
