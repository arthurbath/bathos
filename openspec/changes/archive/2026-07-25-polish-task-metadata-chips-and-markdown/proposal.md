## Why

Compact mobile task metadata is easier to scan when its icon and abbreviated value read as one bounded unit rather than loose fragments. The expanded editor and live Markdown notes also need small spacing and color refinements that improve containment and source readability without adding visual weight.

## What Changes

- Present mobile Waiting, Rechecking, and Deadline metadata as quiet semantic chips.
- Replace compact Deadline labels such as `-4 d` with `-4 days`.
- Slightly increase the horizontal inset inside the expanded task metadata drawer.
- Render recognized Markdown delimiters in muted fixed-width text.
- Render Markdown link labels in ordinary foreground text and their URL destinations in semantic blue while preserving the complete clickable source.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine compact task-list metadata, expanded editor containment, and live Markdown source styling.

## Impact

- Tasks module only.
- Task-row rendering, compact calendar-day formatting, expanded task-editor layout, and live Markdown note token presentation.
- Focused Tasks component and domain tests.
- No database, API, synchronization, migration, dependency, or asset changes.
