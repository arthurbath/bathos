## Context

Task rows currently derive an Area label from the task hierarchy and render it in the secondary metadata line on every view. The Anytime view separately groups those same tasks into visible Area buckets, making the row-level label redundant.

## Goals / Non-Goals

**Goals:**

- Omit the Area label from Anytime task-row metadata.
- Preserve all other task-row metadata and its existing order.
- Preserve Area labels on views where the surrounding layout does not already communicate the Area.

**Non-Goals:**

- Change Area assignment, grouping, ordering, drag-and-drop, or editing.
- Change Someday or other list presentation.
- Change stored task data or synchronization.

## Decisions

- Pass an explicit Area-metadata visibility flag from the route-aware list renderer into `TaskRow`. This keeps the view-specific choice at the parent that already knows the active list and avoids making `TaskRow` infer routing state.
- Include the visibility flag in the metadata-line existence check so an Anytime task whose only secondary detail is Area does not render an empty second line.
- Cover both the omission on Anytime and preservation on another list with component tests.

## Risks / Trade-offs

- [Risk] A hidden Area could accidentally leave an empty metadata line. → Mitigation: derive the line's presence from the same visibility condition used to render the Area item.
- [Risk] Area could disappear from every list. → Mitigation: add a non-Anytime regression assertion.
