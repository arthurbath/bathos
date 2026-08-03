## Context

`TaskSearchResultsView` currently owns a bespoke compact row that displays only a title and route label. Canonical ordinary-task behavior lives in `TaskRow` inside `TasksShell`, while recurrence prototypes use `CalendarRecurrencePrototypeRow` or `WaitingRecurrenceRow`. The search surface already loads the complete task collection and the shell already loads active recurrence definitions, revisions, occurrences, reminders, hierarchy, and mutation services needed by those canonical rows.

Search is a heterogeneous projection rather than a planning list. It must preserve each result's natural-list presentation and task-level controls without acquiring list-level ordering or bulk-selection behavior.

## Goals / Non-Goals

**Goals:**

- Reuse the canonical ordinary-task and recurrence-prototype row implementations for full Search results.
- Derive each result's presentation context and destination from the same natural-route rules used by Quick Find.
- Keep native checkbox, metadata, Primary Link, and ellipsis-menu behavior available for each result.
- Provide predictable Up/Down traversal between the query input and results, with Return revealing the focused result in its native list.
- Make Search explicitly non-draggable, non-bulk-selectable, and outside Tasks Control-command handling.

**Non-Goals:**

- Opening metadata drawers inline within the heterogeneous Search result collection.
- Reordering search results or persisting an order from Search.
- Applying any bulk action across search results.
- Changing search matching, ranking semantics, storage, or native-companion behavior.

## Decisions

1. **Keep search discovery separate from row rendering.** `TaskSearchResultsView` will build and rank a typed union of ordinary-task and recurrence results, own query/input/result focus state, and delegate each result's actual UI to a render callback supplied by `TasksShell`. This keeps search-specific logic small while allowing the shell to configure its canonical row components with the live services they already require.

   Alternative considered: duplicate list-row markup and menus in `TaskQuickFind.tsx`. Rejected because every future list-row change would require a second implementation and could drift again.

2. **Configure canonical rows with a natural presentation context and restricted list mechanics.** Ordinary results will use `TaskRow` with native-list metadata settings, reminders, lifecycle state, and mutation callbacks, but with `selected=false`, no bulk-selection prop, and `draggableTask=false`. Recurrence results will use the canonical dated or waiting prototype component with dragging omitted and activation redirected to Upcoming.

   Alternative considered: navigate immediately from a thin link row and expose no inline controls. Rejected because it does not satisfy native visual or ellipsis-menu parity.

3. **Use one search-owned roving focus index.** The query input begins with DOM focus. Down moves to the first result; result Up/Down traverses canonical rows; Up from the first result restores input focus. Return on a focused row navigates through the existing stable-target mechanism so ordinary tasks open and recurrence definitions receive Upcoming focus without opening repeat management.

4. **Disable task command dispatch at the Search route boundary.** The shell's global Tasks keyboard handler will leave Control-key task commands untouched while `view === 'search'`. Canonical row-local keys needed for result traversal and activation remain available.

5. **Do not mount metadata drawers on Search.** A pointer click or Return on a result's main row follows its real natural-list link and then opens the stable ordinary task there, or focuses a recurrence prototype in Upcoming with repeat management closed. Checkbox, Primary Link, and ellipsis controls remain local interactive exceptions and do not trigger row navigation.

## Risks / Trade-offs

- **Canonical rows have many live dependencies** -> Keep configuration inside `TasksShell`, where update, transition, reminder, recurrence, undo, and navigation services already exist, instead of widening a presentational component into a service locator.
- **A result can disappear after a mutation changes its search match or lifecycle projection** -> Reconcile the roving index to the remaining result count and restore the query input when no row remains.
- **Recurrence definitions have dated and waiting native variants** -> Carry enough recurrence projection state into the search result model to choose the same canonical variant and preserve `Go to Instance` only when it exists natively.
- **Search results can mix contexts with conflicting list mechanics** -> Never provide drag handlers or bulk-selection props, and explicitly bypass Control-key task command dispatch on Search.
