## Context

Deadline and non-actionable Actionability metadata currently gain a quiet filled chip at mobile widths, while the same elements become flat at the small breakpoint. The user prefers one consistently flat second row.

## Goals / Non-Goals

**Goals:**

- Remove chip-only background, border, radius, and padding treatments at every viewport.
- Preserve responsive copy, icons, semantic colors, ordering, spacing, and accessible names.

**Non-Goals:**

- Change task-row height, metadata meaning, field order, or expanded-editor styling.
- Change the focused or selected whole-task background.

## Decisions

- Simplify Deadline and Actionability wrappers to ordinary inline-flex metadata elements.
- Remove the chip-specific data marker and update tests to assert the absence of chip styling.
- Retain the current compact mobile text and hidden full desktop labels.

## Risks / Trade-offs

- [Flat items may have less visual separation] -> Preserve the established metadata-line gap and semantic icons.
