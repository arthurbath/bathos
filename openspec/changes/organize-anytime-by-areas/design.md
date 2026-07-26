## Context

Tasks already stores Areas with a manual `order_key`; each task has a destination-wide planning `order_key`, mutually exclusive `area_id` and `project_id` container references, and a container-local `hierarchy_order_key`. Project tasks derive their effective Area from `tasks_projects.area_id`. Today currently groups by day horizon, while Anytime renders one flat planning list sorted only by the destination-wide planning order.

The change must preserve two independent concepts:

- Planning order controls where a task appears among other tasks in Today, Anytime, and Someday.
- Hierarchy order controls where a task appears inside its direct Area or Project detail.

## Goals / Non-Goals

**Goals:**

- Make Areas the visible top-level organization of Anytime without affecting Today bucketing.
- Preserve one manual planning sequence inside each displayed Anytime Area bucket.
- Let pointer drag express both planning reorder and an explicit Area move.
- Preserve the canonical rule that a task belongs directly to one Area, one Project, or neither.
- Reuse the existing Area order and task organization fields without a database change.

**Non-Goals:**

- Implement Project-specific grouping inside an Area bucket.
- Add Area lifecycle, completion, planning dates, deadlines, notes, or other metadata.
- Replace the existing Area reorder controls with a new drag system.
- Change the `/tasks/projects` route or add a route redirect.
- Group Today, Upcoming, Someday, or Done by Area.

## Decisions

### Derive an effective Area for planning presentation

For each task, the shell resolves its effective Area as the direct `area_id`, or the containing Project's `area_id` when `project_id` is present. A Project task retains only its Project membership in storage.

Alternative considered: copy the Project's Area onto every Project task. Rejected because it would violate canonical single-container membership and create synchronization work whenever a Project moves.

### Keep planning order independent from Area membership

Within every Anytime region, tasks are ordered by their existing destination-wide `order_key`. Area membership decides the region; it does not replace `order_key` with `hierarchy_order_key`. This preserves the established Anytime manual rank and allows direct Area tasks and Project tasks to intermix inside one Area bucket.

Alternative considered: use `hierarchy_order_key` inside each bucket. Rejected because Project tasks and direct Area tasks have different hierarchy scopes and therefore cannot form one coherent sequence.

### Interpret a cross-bucket drop as exact direct placement

A drop inside the task's current effective Area changes only `order_key`. A drop into another Area sets `area_id` to that Area and clears `project_id`; a drop into the unlabelled top region clears both. The repository already assigns the next valid `hierarchy_order_key` when a container changes. The same mutation also saves the requested destination-wide planning `order_key`, so organization and visible placement commit together and enter task undo history as one change.

This means moving a Project task across Area regions intentionally removes it from the Project. Moving it within the Project's current Area region preserves Project membership.

Alternative considered: move the containing Project. Rejected because dragging one task must not silently reorganize sibling tasks or an entire Project.

### Render only meaningful Area headings

The top unassigned region has no heading. An Area heading appears only when at least one task remains visible after ordinary Anytime membership and the active Quick Filter are applied. Buckets follow `tasks_areas.order_key`, regardless of the earliest task order in each bucket.

### Extend contextual creation placement

The existing creation placement gains an optional `areaId`. Activating an Area bucket heading creates and opens an Anytime task assigned directly to that Area. The floating New Task action remains unassigned and appears at the top of the unlabelled region.

### Preserve the Projects route while changing its language

Navigation, page titles, empty/error copy, and Area-detail breadcrumbs use Areas & Projects. Keeping `/tasks/projects` avoids route churn, stale links, and unnecessary deployment compatibility work.

## Risks / Trade-offs

- [A Project task dragged across buckets leaves its Project] → Treat cross-bucket drag as an explicit exact-container move, cover it with tests, and preserve Project membership for same-bucket reorder.
- [Quick Filters can hide all tasks in an Area] → Derive buckets from the filtered projection and omit empty headings.
- [The unlabelled region has no visible drop target when empty] → Keep an unlabelled drop region with sufficient hit area while presenting no text heading; the floating New Task action also creates unassigned work.
- [Area membership and order could update in separate writes] → Send one task patch containing organization and `order_key`, using the existing transactional repository and mutation history path.
- [A retained open task can temporarily no longer match its bucket] → Reuse the editor-retention contract and apply grouping movement only after the task closes.

## Migration Plan

1. Ship the client-only Area grouping and language update.
2. Existing synchronized Area, Project, and task rows immediately derive the new presentation; no data rewrite is required.
3. Rollback restores the flat Anytime renderer and old labels without changing stored data.

## Open Questions

None.
