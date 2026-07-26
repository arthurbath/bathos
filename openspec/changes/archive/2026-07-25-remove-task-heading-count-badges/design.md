## Context

BathOS Tasks currently uses a module-local `TaskCountBadge` component in headings across primary planning lists, hierarchy views, search surfaces, and project checklists. The count is both visible and included in the accessibility tree. The surrounding lists already reveal their contents directly, while operational counts such as bulk-selection totals serve a separate purpose.

## Goals / Non-Goals

**Goals:**

- Make every Tasks heading count-free in both visual and programmatic presentation.
- Preserve heading labels, icons, hierarchy, and list behavior.
- Remove the unused Tasks-only badge component after all heading usages are eliminated.

**Non-Goals:**

- Remove bulk-selection counts, bounded search disclosure, task data, or internal array lengths used for behavior.
- Change the shared grouped DataGrid count convention outside the Tasks module.
- Alter list ordering, filtering, spacing, or task-row styling.

## Decisions

- Remove all `TaskCountBadge` renderings rather than hiding them with CSS. This eliminates both the visible badge and its accessible count without leaving redundant markup.
- Remove the component from every Tasks heading surface, including search and checklist headings, so the request is applied consistently instead of only to the four Today horizons.
- Keep operational counts that are not heading adornments. Those counts communicate selection state or result truncation and are not the visual noise targeted by this change.
- Update focused component tests to assert the absence of count-badge markup while retaining assertions for the correct heading labels and content.

## Risks / Trade-offs

- [Risk] A less frequently visited Tasks surface could retain the old convention. -> Mitigation: Remove every import and usage found across `src/modules/tasks`, delete the component, and enforce a repository search with tests.
- [Risk] Removing a badge near an action control could alter alignment. -> Mitigation: Preserve existing flex containers and verify representative primary and hierarchy views in the rendered app.
