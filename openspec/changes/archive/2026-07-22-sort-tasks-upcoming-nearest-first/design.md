## Context

The Tasks domain already derives one controlling Upcoming date for every eligible project and to-do, and each entity collection is sorted ascending by that date. The shell defeats that ordering by rendering `TaskPlanningProjects` before `UpcomingTaskSections`, creating two chronological islands instead of one chronological page.

## Goals / Non-Goals

**Goals:**

- Produce one owner-visible Upcoming projection ordered by controlling date across projects and to-dos.
- Retain the existing day, month, and year grouping boundaries.
- Retain the established project-card and to-do-row interactions.
- Keep deterministic ordering when multiple items share one controlling date.

**Non-Goals:**

- Change Upcoming membership or controlling-date rules.
- Change project or to-do persistence order.
- Add database columns, migrations, or synchronization behavior.
- Redesign project cards or to-do rows.

## Decisions

### Group a discriminated union at render time

The Upcoming renderer will accept both sorted entity collections, convert them into discriminated project and to-do entries, and group them by their shared controlling date. This keeps the merge local to presentation and leaves the existing domain membership and persistence ordering intact.

An alternative was to render independent project and to-do regions inside each date group. That would still force one entity type above the other on shared dates and would complicate the meaning of top-to-bottom chronological order. A single entry array per group is more direct.

### Use controlling date, then stable entity ordering

Groups sort by their normalized group date ascending. Entries inside a group sort first by exact controlling date, then preserve the existing deterministic order of their source collections. When exact dates match across entity types, projects precede to-dos as the stable tie-breaker; this affects only equal-date peers and never allows a later date above an earlier date.

### Preserve type-specific rendering

Project entries continue through the existing project presentation and callbacks, while to-do entries continue through the existing task-row renderer. No generic cross-entity row is introduced.

## Risks / Trade-offs

- [Risk] Moving project rendering into date groups could disturb project keyboard or action behavior. → Reuse the existing project component and add rendered component coverage for mixed dates.
- [Risk] Month and year groups contain multiple exact dates. → Sort entries again by exact controlling date inside every group.
- [Risk] An open to-do can retain its old projection temporarily. → Continue using the task list's retained projection, so its controlling date changes only when the editor closes.
