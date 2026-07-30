## Context

`TaskQuickFindDialog` already caps combined results at three and hands exhaustive lookup to `/tasks/search`, but it uses the shared full dialog shell, moves browser focus into result links, and treats every task result as an ordinary task to open. The Tasks shell already knows how to open and align an ordinary task after cross-list navigation, and Upcoming already renders recurrence-linked future rows as recurrence-management projections rather than editable task instances.

The redesign must preserve the globally captured type-to-find entry behavior, native text editing in the query input, real-link semantics for pointer activation, existing list derivation, and the established task expansion scroll behavior.

## Goals / Non-Goals

**Goals:**

- Keep Quick Find visually small and centered while the underlying list remains visible.
- Maintain text-cursor focus in the query input while exposing a separate, visible preliminary result selection.
- Consume Escape and the first outside pointer action as dismissal-only interactions.
- Distinguish and correctly target Upcoming recurrence projections.
- Reuse the complete results route and existing task-opening alignment behavior.

**Non-Goals:**

- Replace or redesign the complete `/tasks/search` page.
- Add advanced filtering or custom search operators.
- Change task, recurrence, or synchronization data models.
- Add a visible Quick Find trigger.

## Decisions

### Use a transparent full-viewport dismissal layer around a compact palette

Quick Find will render a fixed transparent dismissal surface with a compact `role="dialog"` panel centered within it. This preserves accessible dialog semantics and makes the first outside pointer action dismiss-only through capture and default prevention without dimming or visually taking over the page.

Keeping the existing shared `DialogContent` was considered, but rejected because its title, close control, sizing, focus traversal, and overlay behavior are the visual and interaction weight being removed.

### Keep DOM focus in the query input and model preliminary selection in state

The palette will own one active-item index spanning the visible task results plus Continue Search. Up and Down update that index while preventing the input's native caret movement. Return activates the indexed item. Query changes reset the index to the first result, or Continue Search when there are no results.

Moving DOM focus through result links was considered, but rejected because it interrupts uninterrupted type-to-find and makes subsequent printable input depend on focus restoration.

### Search task records only and derive recurrence projections from planning state

Quick Find will build results from the existing task search documents. A task with a recurrence definition whose natural planning route is Upcoming is presented as a recurrence projection and receives the repeat icon. The same recurrence's materialized Today or Anytime instance remains an ordinary task result, allowing both records to appear when both match.

Adding recurrence definitions as a second database query was considered, but rejected because current Upcoming recurrence rows are already represented by task projections and the required target identity is the projected task row.

### Rank summaries ahead of ancillary task metadata

Quick Find will assign ordered match tiers before limiting results to three. An exact summary match ranks first, followed by a summary prefix and then any summary containing the query. Source-title, Area, notes, and source-URL matches remain searchable but rank below every summary match.

Using one undifferentiated concatenated search document was considered, but rejected because a URL or note containing a common product name could displace a visibly exact summary result from the compact three-result set.

### Pass explicit activation intent to the Tasks shell

Quick Find will report whether a task result should open or only receive whole-row focus. The shell will retain the existing cross-route target handoff for ordinary tasks. For recurrence projections it will navigate to Upcoming, wait for the projected row, apply whole-row focus without opening recurrence management, and use the row's established nearest-scroll behavior.

## Risks / Trade-offs

- [A recurrence projection may not yet be rendered when navigation completes] -> Keep the target intent in shell state until the matching task appears in the current projection.
- [Transparent modal behavior can become invisible to assistive technology] -> Keep a named `role="dialog"`, label the input, expose the preliminary selection with `aria-activedescendant`, and mark result options through a listbox relationship.
- [An outside pointer event can leak to underlying controls] -> Consume the pointer-down event on the dismissal layer before closing.
- [Deferred search results can briefly lag the typed query] -> Reset preliminary selection whenever the rendered result identities change and keep loading/error states inside the compact panel.

## Migration Plan

This is a web-only component and shell behavior change. Deploy the new Quick Find surface with the matching Tasks release. Rollback consists of restoring the previous `TaskQuickFindDialog` implementation and target handoff; no data migration or cleanup is required.

## Open Questions

None.
