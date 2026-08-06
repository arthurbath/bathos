## Context

The shared `TabsList` has a fixed `h-10` standard-input height, a one-pixel border, and four pixels of internal padding. `TabsTrigger` currently derives its own height from a 20-pixel line height plus 12 pixels of vertical padding, which is taller than the list's 30-pixel inner content box. The trigger therefore overflows toward the bottom instead of sitting centrally inside the list.

## Goals / Non-Goals

**Goals:**

- Retain the existing tab list height and visual treatment.
- Constrain each trigger to the list's available inner height and center its content.
- Apply the correction uniformly through the shared primitive.

**Non-Goals:**

- Redesign tab colors, radii, typography, or focus behavior.
- Change the height of standard inputs or tab lists.
- Introduce a separate authentication-only tab variant.

## Decisions

- Give the shared trigger `h-full` and remove its independent vertical padding. The existing flex centering then centers the label within the exact inner height supplied by the list.
- Keep horizontal padding and every state class unchanged, preserving width, active fill, focus rings, disabled behavior, and Radix semantics.
- Add a shared primitive regression test that asserts the list-height and trigger-fill classes. Rendered QA on the sign-in surface provides visual proof of the resulting geometry.

## Risks / Trade-offs

- **Risk:** Consumers that relied on trigger overflow could become slightly shorter. **Mitigation:** The tab list's intended standard-input height is the controlling contract, and all consumers use the shared primitive without custom vertical sizing.
- **Risk:** A future class override could reintroduce conflicting height or padding. **Mitigation:** Keep a direct shared-component regression for the canonical default classes.
