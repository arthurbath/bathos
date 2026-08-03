## Context

Tasks already retains an open task in its current projection until the metadata drawer closes. Departure feedback is similarly deferred by comparing each accepted metadata mutation with the identifier of the open drawer. Existing tasks use the same identifier in both places, but a new-task drawer continues to use a synthetic draft identifier after its task has been persisted. Subsequent autosaves report the persisted identifier, so the departure handler can misclassify that visibly open task as closed and announce a move before it occurs.

## Goals / Non-Goals

**Goals:**

- Make toast timing follow the physical open editor rather than one identifier representation.
- Defer departure feedback for existing tasks and persisted creation drafts until close reconciliation actually removes the row.
- Preserve immediate feedback for successful mutations to closed tasks and bulk selections.

**Non-Goals:**

- Change list-membership, filter, sorting, or drawer-close behavior.
- Change toast wording, duration, styling, or placement.
- Change persistence, database schema, or native companions.

## Decisions

### Resolve the persisted task owned by the open editor

The shell will resolve one persisted task identifier for the current editor. An ordinary editor owns its selected task identifier. A creation editor owns its draft's persisted identifier once persistence has occurred. Metadata mutations matching that resolved identifier are retained for close reconciliation and cannot emit immediate departure feedback.

This keeps editor identity centralized at the shell boundary. An alternative was to replace the synthetic creation identifier as soon as persistence completed, but that would disturb draft-specific rendering, cancellation, and focus behavior far beyond the toast defect.

### Keep close reconciliation as the only deferred notification boundary

The existing ordinary-task and creation-draft close paths already classify the final task against the current view and emit at most one final departure notice after close settlement. The fix will route all open-editor mutations into those paths rather than introducing a second queue or timer.

This also preserves the existing behavior where a later edit restores eligibility before close and no stale notice appears.

### Verify through user-level Start interactions

Regression coverage will drive the Start picker on an open task and the Actionability control on a persisted creation draft under a quick filter. Tests will assert that a departing mutation produces no toast while the drawer remains open and exactly one appropriate toast after close.

## Risks / Trade-offs

- **[Risk] The creation draft persists between two event-loop steps while its metadata mutation is reported.** -> Resolve ownership from the current draft's already-known persisted identifier before processing the mutation callback.
- **[Risk] A closed task could be mistaken for open after close begins.** -> Preserve the existing close lifecycle ordering that clears editor identity before applying the final departure projection.
- **[Risk] An edit moves out of view and then restores eligibility.** -> Recompute from the latest accepted task at close instead of caching an earlier departure classification.
