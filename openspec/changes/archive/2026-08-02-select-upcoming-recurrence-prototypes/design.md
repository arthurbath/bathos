## Context

Upcoming renders ordinary task rows and dated recurrence prototype rows in one ordered day-bucket projection, but only ordinary task identifiers participate in selection. Drag state similarly carries many ordinary task identifiers or one prototype identifier, which prevents a mixed selected group from moving as one visible unit.

Recurrence dates remain schedule-owned. Reordering may change a prototype's `upcoming_order_key`, but it must never rewrite the prototype's scheduled occurrence date.

## Goals / Non-Goals

**Goals:**

- Use one transient selection namespace for ordinary tasks and dated prototypes while retaining their distinct persistence identities.
- Give prototype rows the same selection gestures, circular selection affordance, selected highlight, and trailing-control suppression as ordinary task rows.
- Apply Area, Actionability, and Delete to every selected ordinary task and recurrence prototype through each entity type's guarded mutation path.
- Reorder mixed selected rows together inside one Upcoming date bucket.
- Filter schedule-ineligible prototypes out of a cross-day drop while allowing eligible ordinary tasks to move.
- Make the top-right lasso a persistent toggle with an accessible active state.

**Non-Goals:**

- Bulk editing recurrence cadence, Start, Deadline, or completion state across recurrence prototypes.
- Selecting waiting recurrence prototypes that do not occupy a dated Upcoming bucket.
- Changing recurrence cadence or occurrence dates through drag and drop.
- Adding database tables, RPCs, or migrations.

## Decisions

1. **Use namespaced row identifiers only for prototypes.** Ordinary task selections keep their existing task UUID values. Prototype selections use `recurrence:<definition-id>`. This minimizes changes to existing task bulk actions while preventing identity collisions.

2. **Build the selectable order from the rendered Upcoming rows.** Shift ranges and Select All use the same interleaved ordinary-task/prototype order that the user sees, rather than concatenating two backing collections.

3. **Treat drag membership as two typed identifier sets.** The primary dragged row may be either kind, while refs retain every selected task ID and prototype definition ID. Drop targeting ignores every member of the dragged group.

4. **Apply schedule legality per prototype.** A selected prototype participates in a drop only when its schedule-owned day bucket equals the target bucket. Other selected prototypes receive no persistence write and remain in their original bucket. Ordinary selected tasks continue using the existing cross-day planning patch.

5. **Expose only shared mixed-selection edits.** Edit remains enabled for mixed and prototype-only Upcoming selections. Area and Actionability write ordinary tasks through the task batch-patch path and write prototypes through immutable recurrence revisions. Delete transitions ordinary tasks to Done and archives selected prototypes. Start and Deadline remain hidden unless every selected row is an ordinary open task.

6. **Keep the lasso mounted in both states.** The button uses `aria-pressed` and the established information highlight while active. Activating it while active calls the same canonical selection cancellation path as the toolbar Cancel action.

## Risks / Trade-offs

- **Mixed persistence is not one database transaction** -> Generate one ordered key sequence, update ordinary tasks through the existing batch path, then update eligible prototypes through their guarded recurrence reorder path. Preserve the selected group and surface existing errors if a write fails.
- **Cross-day mixed drops can partially move the selection** -> This is intentional: ordinary tasks may adopt the target date, while schedule-owned prototypes remain where their recurrence requires. Regression tests will assert that prototypes receive no illegal reorder or date mutation.
- **Mixed mutations span task and recurrence persistence paths** -> Resolve both typed target sets before mutation, run every applicable guarded write, preserve selection for surviving rows, and surface a bulk failure if either path rejects.
