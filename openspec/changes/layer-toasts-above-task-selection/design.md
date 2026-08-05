## Context

The shared Radix toast viewport uses stacking layer 35. The Tasks selection-mode bar currently uses layer 40, the same layer as mobile navigation, so the bar can cover toast content. The durable visual contract requires mobile navigation to remain above toasts.

## Goals / Non-Goals

**Goals:**

- Keep shared toast notifications visible during task selection mode.
- Preserve the existing mobile-navigation-over-toast relationship.
- Protect the layer relationship with automated and rendered checks.

**Non-Goals:**

- Reposition toasts or the selection bar.
- Change toast timing, animation, content, or interaction behavior.
- Change modal-content, popover, or navigation stacking.

## Decisions

- Use the explicit hierarchy selection controls 33, modal backdrops 34, both toast systems 35, mobile navigation 40, and modal content 50. This keeps modal dimming above fixed in-content controls, keeps error feedback visible above the backdrop, and preserves both modal content and mobile navigation above the toast stack.
- Add a focused Tasks rendering assertion that compares the declared selection layer with the shared toast layer. This catches future regressions without coupling the test to browser-specific stacking calculations.

## Risks / Trade-offs

- [Risk] Lowering the selection bar could place it beneath list-local sticky content. -> Mitigation: keep it above ordinary list content and verify the actual selection-mode rendering in the browser.
- [Risk] A future layer change could invalidate the numeric relationship. -> Mitigation: document the hierarchy in the durable visual spec and enforce it in regression coverage.
