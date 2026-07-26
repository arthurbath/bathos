## Why

Tasks currently splits keyboard focus across the completion control, title body, and actions menu while treating every modified-click selection as bulk mode. A whole-task focus state will make daily keyboard operation predictable, let every task command target one closed task, and reserve the bulk toolbar for genuinely multi-task work.

## What Changes

- **BREAKING** Keep each collapsed task row focusable while restoring its completion, title, source link, and actions controls to the ordinary sequential Tab order.
- Introduce distinct none, single-focus, multi-selection, and open-task states with deterministic transitions and visual treatment.
- Preserve native page-wide Tab and Shift+Tab traversal so keyboard users can enter, traverse, and leave the task list without a trap.
- Let unmodified Space establish whole-task focus at the first visible task from an eligible Tasks background, promote a Tab-focused task row into whole-task focus, and advance whole-task focus through the visible task order; let Shift+Space reverse that traversal.
- Make ArrowDown and ArrowUp wrap whole-task focus through the flattened visible task order and scroll the focused task into view.
- Clear whole-task focus when granular Tab traversal begins while preserving native Space behavior for task controls, links, editors, overlays, and unrelated page controls.
- Make the first modified click establish single-task focus and a range anchor without showing bulk controls; show bulk controls only when at least two tasks are selected.
- Let task commands target one focused closed task, a single open task, or multiple selected tasks.
- Turn the existing Close Task command into Open/Close Task and return focus to the whole row after closing.
- Preserve modified-click link behavior and direct checkbox or ellipsis actions without changing task focus or selection unintentionally.
- Clear task focus and multi-selection on outside interaction or view navigation, and keep open-task and multi-selection states mutually exclusive.
- Let Escape relinquish either granular or whole-task focus from a collapsed task without opening, selecting, or mutating it.
- Normalize action-driven return focus through the complete task row so completion, menu, dialog, and lifecycle actions never strand focus on a nested checkbox, title, source, or actions control.
- Transfer closed-row focus to a newly duplicated task when duplication starts from one focused closed task.
- Make bulk actionability changes converge mixed selections to Waiting before advancing a uniformly Waiting selection to Rechecking and a uniformly Rechecking selection to Ready.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Redefine task-row focus, Tab order, pointer selection thresholds, command targeting, open/close behavior, traversal, duplication focus, and accessibility presentation.

## Impact

This affects the Tasks shell state model, task-row markup and focus restoration, pointer-selection helpers, keyboard and Space dispatch, clipboard and duplication behavior, command-reference copy, task interaction tests, and the durable Tasks specification. It changes no database schema, Supabase function, synchronization contract, or production data.
