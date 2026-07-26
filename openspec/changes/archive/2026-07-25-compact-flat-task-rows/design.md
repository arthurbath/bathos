## Context

Tasks currently renders active, Done, and Trash task rows as 56-pixel rounded cards with a subtle border, resting background, and a gap between items. That treatment is visually clear but spends substantial vertical space on repeated boundaries. The selected reference direction relies on alignment and typography to preserve row association, reserving surfaces for interaction and expansion states.

Planning-project cards share some task-row constants but remain semantically distinct containers. This change therefore separates task-list density from project-card presentation instead of flattening every planning item.

## Goals / Non-Goals

**Goals:**

- Fit more collapsed tasks into every list, especially on mobile.
- Preserve a consistent 44-pixel target and row height regardless of metadata.
- Remove resting task-card decoration while retaining clear focus, selection, transition, and expansion states.
- Make whole-task keyboard focus visually identical to the quiet task selection highlight.
- Keep an expanded editor visibly contained with its summary row.

**Non-Goals:**

- Redesign planning-project cards, headings, task metadata, icons, or editor controls.
- Change sorting, keyboard commands, drag-and-drop behavior, task persistence, or terminal transitions.
- Change any database, synchronization, reminder, or MCP behavior.

## Decisions

### Separate task-list and project-list presentation constants

Task lists will use a gapless stack, while planning-project lists retain their existing card gap and frame. This avoids changing project semantics merely because the current implementation shares constants.

Alternative considered: flatten both tasks and projects. Rejected because the request and selected reference concern task rows, and project cards are larger navigation objects rather than compact actionable rows.

### Use a 44-pixel collapsed row contract

Collapsed task headers and terminal task rows will use a fixed 44-pixel height. Existing title truncation and the single-line metadata rail remain in place so optional details cannot grow the row.

Alternative considered: retain 56 pixels and only remove the border. Rejected because it would not provide the requested mobile-density improvement.

### Reserve surfaces for meaningful states

Resting collapsed rows will have no border, background, radius, or outline. Focused, selected, and bulk-selected tasks will use the same quiet semantic background highlight. Expanded tasks will use a quiet background and rounded containment around both header and editor. Keyboard focus will not add a gold or white ring around the task.

Alternative considered: retain a focus ring over the flat row. Rejected because the user explicitly selected background highlighting for parity with selection mode.

### Preserve internal control targets

The row itself remains 44 pixels tall, and its checkbox, title, source-link, and action controls retain full-row or near-full-row hit targets. Visual icons remain at their current sizes.

## Risks / Trade-offs

- [Adjacent resting rows may read as one continuous block] -> Preserve aligned checkbox, title, metadata, source, and action columns, and verify the result at the selected mobile viewport.
- [A background-only focus state may have insufficient contrast] -> Reuse the established selection surface token and test keyboard-focused, selected, and expanded states in the rendered app.
- [Shared constants may accidentally flatten project cards] -> Introduce task-specific list-state constants and keep project-card frame constants local to planning projects.
- [Reduced row height may clip two-line content] -> Keep title and metadata line heights bounded inside the 44-pixel header and cover metadata-rich rows in tests and browser QA.
