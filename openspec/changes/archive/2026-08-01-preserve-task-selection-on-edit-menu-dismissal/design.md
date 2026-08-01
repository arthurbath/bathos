## Context

Tasks has a document-level outside-pointer handler that exits selection mode when a pointer lands outside task rows and selection-owned surfaces. Radix dismisses the portaled Edit menu from that same outside pointer, but the document capture handler currently clears selection before the menu can consume the dismissal.

## Goals / Non-Goals

**Goals:**

- Let an outside pointer dismiss the open selection-mode Edit menu without clearing selection mode.
- Preserve the selected task membership and range anchor.
- Keep ordinary outside-selection dismissal unchanged when no selection-owned menu is open.

**Non-Goals:**

- Change menu options, bulk mutation behavior, or explicit selection exit commands.
- Change singular task ellipsis menu behavior.

## Decisions

- Treat an open selection-owned portaled menu as owning the next outside pointer. The document-level selection dismissal handler will return while that menu is open, allowing Radix to close only the menu and consume the outside interaction.
- Retain the existing general outside-pointer rule after the menu has closed. A later independent click outside task rows and selection controls may still exit selection mode.

## Risks / Trade-offs

- **Risk:** A broad open-surface guard could preserve selection for unrelated menus. **Mitigation:** Scope the guard to an open element bearing the existing `data-task-bulk-selection-surface` marker.
