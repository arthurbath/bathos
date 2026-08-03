## Why

Checking a checklist item currently produces a delayed, multi-step reorder that can visibly jump before settling. Completion should acknowledge the click immediately and move the row through one coherent animation, or settle without motion when animation is unavailable.

## What Changes

- Apply checklist completion optimistically so the checked state and resulting order appear in one render transaction.
- Animate the completed row and displaced rows from their exact pre-completion positions to their final positions.
- Avoid replaying or restarting the completion motion during database synchronization renders.
- Respect reduced-motion preferences by applying the final order without animation.
- Restore the prior checklist state and order if persistence fails.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that checklist completion is acknowledged immediately and reorders through one stable motion transaction without synchronization flicker.

## Impact

- Tasks checklist editor layout animation and completion mutation lifecycle.
- Optimistic checklist state reconciliation in the Tasks checklist hook.
- Focused component and hook regression coverage.
- No schema, migration, API, native-companion, or dependency changes.
