## Context

The expanded task editor currently mixes a visually hidden Task Title label with visible labels for Primary Link, Start, Deadline, Actionability, and Organization. Empty text and date controls already expose identifying placeholder text, while select controls expose their current value and programmatic name. The persisted data model uses `title` and `actionable`, and those stable values are shared by synchronization, history, clipboard, MCP, and production data.

## Goals / Non-Goals

**Goals:**

- Use Summary as the canonical user-facing name for a task's primary text field.
- Remove repeated visible labels from the metadata drawer without weakening accessibility.
- Reveal the Primary Link activation control only when the input contains text.
- Use Ready as the user-facing label for the `actionable` state everywhere in Tasks.
- Keep active Tasks change artifacts aligned with the new vocabulary.

**Non-Goals:**

- Renaming database columns, TypeScript properties, RPC fields, MCP fields, or actionability enum values.
- Changing actionability behavior, filtering semantics, task validation rules, or link normalization.
- Removing labels from date-picker popovers, dialogs, project forms, or controls outside the expanded task metadata drawer.

## Decisions

- Replace drawer label elements with explicit `aria-label` values on their controls. Summary and Primary Link use matching placeholders, Notes keeps its existing placeholder, and empty date controls retain their identifying empty-state copy.
- Render the Primary Link activation button only when the controlled input string is nonempty. The control remains disabled until the value resolves to a supported destination.
- Centralize user-facing actionability labels in the existing presentation surfaces rather than changing the stored enum. Ready maps to `actionable`, Waiting maps to `waiting`, and Rechecking maps to `rechecking`.
- Update user-facing validation language from title to summary where repository or clipboard validation can surface an error.

## Risks / Trade-offs

- [Risk] Removing visible labels can reduce discoverability for filled controls. → Mitigation: Preserve clear control values, field-specific placeholders for empty controls, and explicit accessible names.
- [Risk] A one-character Primary Link exposes a disabled activation icon. → Mitigation: This deliberately distinguishes field occupancy from destination validity while honoring the requested reveal threshold.
- [Risk] Active changes could later restore Actionable copy. → Mitigation: Update the applicable active quick-filter and focus-navigation artifacts alongside the implementation.
