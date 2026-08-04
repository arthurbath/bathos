## Context

The primary Tasks lists currently render empty messages in two paths: a whole-view branch when no underlying rows exist and an in-list branch when an active quick filter removes all visible task rows while other non-task content can remain. Area detail owns another task-list empty state. Full Search owns separate query guidance and no-match states plus a static `Tasks` heading above its single result collection.

## Goals / Non-Goals

**Goals:**

- Give every task-list empty state one consistent, modestly celebratory Sparkles treatment.
- Preserve a filter-specific explanation when filtering causes the empty projection.
- Enforce the existing sentence-case policy for the affected empty-state copy.
- Keep Search empty states visually neutral and remove its redundant single-bucket heading.

**Non-Goals:**

- Changing list membership, quick-filter logic, search ranking, result interaction, or loading and error states.
- Introducing a cross-module platform empty-state component before another module needs the same exact treatment.
- Adding Sparkles to Quick Find or full Search guidance.

## Decisions

### Use one Tasks-scoped empty-state component

Create a small Tasks component that renders a medium canonical Sparkles icon above a sentence-case message. Both whole-list and filter-empty branches will use it so spacing and accessibility do not drift. A shared platform primitive was considered, but this treatment is currently a Tasks-specific product decision.

### Register Sparkles in Tasks iconography

The icon will be added to the canonical Tasks icon registry rather than imported directly into the rendering component. This preserves the module's established icon governance and documentation checks.

### Keep Search structurally labeled but visually unbucketed

The Search result section retains its accessible label but removes the visible `Tasks` heading. Its two non-error empty messages remain text-only and use sentence case. This avoids implying that Search has task buckets while preserving a named region for assistive technology.

## Risks / Trade-offs

- **Risk: The celebratory icon could suggest success when a filter merely hides tasks.** -> Retain the explicit `No tasks match this filter` message directly beneath the icon.
- **Risk: Removing the Search heading could reduce visual hierarchy.** -> The page title, search field, spacing, and accessible results-region label continue to establish the hierarchy without a redundant bucket label.
