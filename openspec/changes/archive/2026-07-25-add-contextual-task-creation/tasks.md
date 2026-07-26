## 1. Contextual draft placement

- [x] 1.1 Extend task creation drafts with normalized optional Today-horizon and Upcoming-Start placement overrides
- [x] 1.2 Add deterministic helpers and tests for resolving the first visible Today or Upcoming bucket and empty-view fallbacks
- [x] 1.3 Render the active draft at the top of its resolved list bucket without changing keyboard creation defaults

## 2. Creation affordances and editor spacing

- [x] 2.1 Remove the header New Task action and add a large safe-area-aware floating creation button on active planning views
- [x] 2.2 Make Today and Upcoming task-bucket headings semantic creation controls with hover/focus Plus affordances
- [x] 2.3 Add the four-pixel static Title inset while preserving the single-stage disclosure animation

## 3. Verification and closeout

- [x] 3.1 Add component tests for floating-action visibility, first-bucket inheritance, bucket heading creation, in-bucket placement, and editor spacing
- [x] 3.2 Run focused Tasks tests, Tasks typechecking, lint, build, and strict OpenSpec validation
- [x] 3.3 Verify desktop and mobile rendered behavior, safe-area clearance, interaction state, and console health
- [x] 3.4 Sync the delta spec and archive the completed OpenSpec change
