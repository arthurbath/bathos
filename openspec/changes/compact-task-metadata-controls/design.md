## Context

The open task editor renders Summary, the custom Markdown Notes editor, optional Primary Link and Checklist surfaces, and planning controls in one vertical form. Notes currently reserves four lines through a fixed minimum height. Primary Link and Checklist independently render their own disclosure actions, so when both are absent they consume two full rows even though the actions are short.

The task row already receives the list model's persisted-checklist indicator, while the checklist surface owns the live item query and transient draft state. The parent editor owns the Primary Link disclosure state and the surrounding form layout.

## Goals / Non-Goals

**Goals:**

- Reserve exactly two visible text lines plus the existing vertical padding as the empty Notes minimum.
- Let the parent editor reliably distinguish an empty checklist disclosure from real checklist content.
- Present both absent-metadata actions as one equal-width row, then return the remaining action to the ordinary standalone treatment as soon as either metadata surface is present.
- Reuse the same divider color and inset for the paired disclosure row and Start picker's terminal actions.
- Preserve the existing DOM and keyboard order: Primary Link before Checklist, and Clear before Someday.

**Non-Goals:**

- Change Notes editing, Markdown rendering, autosave, or maximum growth.
- Change how Primary Link or Checklist data is created or persisted.
- Add a shared segmented-control primitive or alter unrelated buttons.
- Change date-picker selection behavior.

## Decisions

### Report checklist presence to the parent editor

`TaskEditor` will initialize checklist presence from the task row's existing persisted-checklist indicator. `TaskChecklistEditor` will then expose a small presence callback after its query has loaded and whenever persisted items or its draft row change.

This avoids a false empty state while the checklist query loads and keeps the existing query in one place. Duplicating the query in `TaskEditor` was rejected because it would add another live subscription solely for presentation. CSS `:has()` inference was rejected because explicit component state is easier to test and does not make parent layout depend on descendant implementation details.

### Keep the adaptive actions in one parent layout wrapper

The parent will wrap the Primary Link and Checklist surfaces in a disclosure layout. It uses a two-column grid only when Primary Link is undisclosed and the checklist reports no content. In that state both actions fill their column, center their contents, and a noninteractive centered rule supplies the divider. Every other state uses the current vertical stack, auto-width action, and left alignment.

### Derive the Notes minimum from line height

Notes uses a 1.5rem line height and 0.5rem vertical padding on each side. A 4rem minimum therefore exposes two full lines without clipping. The lazy-loading fallback will use the same minimum to avoid a post-load layout shift.

### Use one divider treatment

Both paired surfaces will use `--grid-sticky-line` at one pixel wide with a short vertical inset. This is already the muted structural rule used by task form controls and avoids introducing decorative color.

## Risks / Trade-offs

- **Checklist presence changes after an asynchronous query** → Initialize from the list model's persisted-checklist indicator and accept live updates only after the checklist query loads.
- **A new checklist draft changes layout while focus moves into it** → Report the draft as checklist content so the disclosure row becomes a vertical editor before the input receives focus.
- **A narrower Notes field may make long content appear denser** → Preserve unlimited content growth and the existing multiline editor behavior; only the empty or short-content minimum changes.
