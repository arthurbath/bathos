## Context

The collapsed task row currently derives one hierarchy label, then renders Actionability, Start, Deadline, and Reminder. Tasks assigned to a project do not directly carry the project's parent area, so the row must derive that area through the hierarchy model. Upcoming already groups work by Start, while Today communicates horizons through its section structure and leading marker.

## Goals / Non-Goals

**Goals:**

- Render optional metadata in the stable order Area, Project, Reminder, Deadline, Actionability.
- Derive a project's parent Area without changing task persistence.
- Remove Start and horizon copy from collapsed summaries across every task list.
- Preserve current density, responsive deadline/actionability treatment, semantics, and truncation.

**Non-Goals:**

- Change the expanded task editor or stored organization/planning data.
- Change Upcoming or Today grouping.
- Add icons or new visual treatments for Area and Project.
- Change project, area, reminder, deadline, or actionability editing behavior.

## Decisions

- Replace the single hierarchy-label helper with a helper that returns independent Area and Project labels. For project tasks, Project comes from the task's project and Area comes from that project's `area_id`; loose area tasks use the task's direct `area_id`.
- Render each metadata item as its own conditional child in canonical order. This naturally removes absent values without placeholders and makes DOM order testable.
- Remove the Start metadata branch entirely rather than hiding it per view. List grouping already supplies the only useful Start context, and a uniform rule prevents redundant or inconsistent summaries.
- Keep existing reminder, deadline, and actionability markup intact while relocating it, preserving responsive chips, colors, icons, and assistive labels.

## Risks / Trade-offs

- [Long Area and Project names consume more of the single metadata line] -> Keep both independently truncatable and preserve the row's existing nonwrapping overflow boundary.
- [A project references a missing area] -> Omit the unavailable inherited Area while retaining the Project label; continue using the existing unavailable-project fallback when the project itself cannot be resolved.
- [Tests coupled to the old child count or Start labels fail] -> Replace those assertions with explicit canonical-order and Start-absence assertions.
