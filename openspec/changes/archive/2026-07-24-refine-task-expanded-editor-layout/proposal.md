## Why

The expanded Tasks editor still carries layout and control styling from its former full-width row treatment, leaving an unnecessary divider, excess inset, inconsistent borders, native selects, and an unintuitive field order inside the new bounded task card. Refining the editor now lets the expanded state feel like one coherent BathOS form contained by the task itself.

## What Changes

- Remove the redundant horizontal divider, large top padding, and desktop-only left indentation from the expanded editor.
- Let editor controls use the task card's full content width while retaining the card's ordinary responsive horizontal padding.
- Reorder the expanded state as Summary, Title, Notes, Primary Link, Start, Deadline, Actionability, and Organization.
- Replace the native Actionability and Organization selects with the shared BathOS Select trigger and popover components.
- Align Notes with the shared BathOS text-input border and focus treatment.
- Present Primary Link as a standard URL-style input with an adjacent open-link control, and remove the dedicated one-click clear button.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the expanded to-do editor's containment, field order, shared control styling, and Primary Link interaction.

## Impact

- Affects the Tasks expanded editor in `src/modules/tasks/components/TasksShell.tsx`.
- Aligns Task Notes styling in `src/modules/tasks/components/TaskMarkdownNotes.tsx`.
- Reuses existing shared `Input`, `Select`, and Lucide control conventions without new dependencies.
- Requires Tasks component regression tests and rendered desktop and narrow-viewport QA.
- Does not change Supabase data, synchronization, autosave semantics, task history, or external APIs.
