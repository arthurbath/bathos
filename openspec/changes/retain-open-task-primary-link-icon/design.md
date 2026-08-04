## Context

`TasksShell` currently places the protocol-derived `TaskSourceIndicator` and the task ellipsis menu inside one trailing-controls container whose entire visibility is conditioned on the task being closed. Opening the task therefore removes both controls even though only the ellipsis menu is intended to be closed-task-only.

## Goals / Non-Goals

**Goals:**

- Keep the existing Primary Link icon and external action visible in an open task's ordinary summary row.
- Preserve the summary-row layout and the existing protocol-specific icon behavior.
- Preserve the existing visibility rules for the ellipsis menu and bulk-selection state.
- Present the Primary Link field's external action as a semantic blue info-outline button.

**Non-Goals:**

- Changing Primary Link parsing, protocol-derived decorations, destinations, or field layout.
- Making the ellipsis menu available while a task is open.
- Changing bulk-selection behavior.

## Decisions

- Separate the link indicator's visibility from the ellipsis menu within the existing trailing-controls wrapper. This keeps the layout stable and avoids duplicating `TaskSourceIndicator` or link-resolution logic.
- Render the wrapper and Primary Link indicator for ordinary rows whenever bulk selection is inactive. Continue to render the ellipsis menu only when the task is closed.
- Extend the existing Primary Link component test through the closed-to-open transition so the same `href`, new-tab behavior, and accessible label are verified in both states.
- Use the shared `outline-info` button variant for the field-level external-link action and avoid local border/background overrides so the shared semantic colors remain authoritative.

## Risks / Trade-offs

- **Risk: The open summary gains unexpected trailing spacing when no Primary Link exists.** -> Keep the existing compact flex wrapper, whose empty state has no intrinsic width.
- **Risk: Relaxing the outer visibility condition accidentally exposes the ellipsis menu while editing.** -> Retain an explicit closed-task condition directly around the menu and cover it in the regression test.
- **Risk: A local border class overrides the semantic info border.** -> Remove the existing `border-input` and redundant background overrides from this shared-variant consumer.
