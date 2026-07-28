## Context

Checklist multi-selection is transient editor state layered over ordinary text inputs. The initial implementation preserved the previously focused input so Shift-click could establish a selection anchor, but it did not relinquish DOM focus after selection was established. Task rows already derive optional Area, reminder, Deadline, and actionability metadata from synchronized task projections, while checklist content is available through the existing checklist relationship.

## Goals / Non-Goals

**Goals:**

- Make checklist group selection visually and behaviorally exclusive from text editing.
- Preserve the focused item as the selection anchor before relinquishing DOM focus.
- Expose checklist presence in the compact task metadata line using the established `ListTree` icon.
- Avoid extra queries or per-row request waterfalls.

**Non-Goals:**

- Add checklist counts, progress, labels, or bulk completion actions.
- Change checklist persistence, ordering, or task-row height.
- Introduce schema, API, or synchronization changes.

## Decisions

- Blur the active checklist input synchronously after computing a modified-click selection gesture. This preserves the focused item as the gesture anchor while ensuring no text caret remains once selection is active.
- Keep the existing document-level Delete and Backspace capture authoritative while checklist selection exists. Other printable input has no target after blur and therefore cannot edit checklist content.
- Derive checklist presence from the task data already loaded into the list view and pass one boolean into the row presentation. The indicator remains a pure rendering concern and does not initiate checklist loading.
- Render Lucide `ListTree` as icon-only metadata immediately before actionability. This follows the canonized Task checklist icon and avoids introducing redundant copy or counts.

## Risks / Trade-offs

- [Risk] Programmatic blur could remove the anchor needed for a subsequent Shift-click → Mitigation: retain the transient selection anchor in React state independently from DOM focus.
- [Risk] Checklist presence could cause per-row fetching → Mitigation: derive it only from the existing list projection or shared in-memory checklist data.
- [Risk] The new icon could increase row height or disrupt metadata order → Mitigation: use the existing compact metadata treatment and verify desktop and mobile row rendering.
