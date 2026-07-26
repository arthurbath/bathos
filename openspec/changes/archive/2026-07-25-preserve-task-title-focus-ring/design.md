## Context

The task editor currently uses a four-pixel transform to create visual separation above Title without changing the grid disclosure's intrinsic height. The disclosure and its inner child both clip overflow. That arrangement can crop the Title input's focus ring because transformed paint is not ordinary layout space.

## Goals / Non-Goals

**Goals:**

- Reserve real layout room above Title for the complete focus ring.
- Keep the editor's expansion and spacing change synchronized as one motion.
- Retain the existing horizontal inset, bottom padding, field gap, duration, easing, focus placement, and reduced-motion behavior.

**Non-Goals:**

- Changing shared input focus styling.
- Redesigning task fields or the summary row.
- Changing task persistence or list placement.

## Decisions

- Remove the form translation and keep the form itself free of leading spacing.
- Put four pixels of ordinary top padding on the disclosure region, where it represents the boundary between the summary row and metadata form.
- Transition `padding-top` from zero to four pixels in the same declaration, duration, and easing as the grid-row and opacity transition. This prevents a constant inset from appearing only in the final pixels of a natural-height grid expansion.
- Remove `overflow-hidden` from the inner grid child. The outer disclosure remains the single clipping owner during motion, while its top padding gives the focused Title ring room to paint at rest.

Using static form padding was rejected because it already reproduced the late spacing step. Keeping the transform and increasing it was rejected because it does not create layout space and continues to depend on clipping behavior. Replacing the disclosure with JavaScript-measured pixel heights was rejected as unnecessary complexity when the existing grid transition can animate the spacing property concurrently.

## Risks / Trade-offs

- The top inset grows from zero during opening instead of existing at full size from the first frame. This is intentional: it synchronizes the space with the disclosure rather than revealing it afterward.
- Removing the inner clip changes overflow ownership. The outer region retains `overflow-hidden`, and component plus rendered tests verify that collapsed content remains hidden and the open focus ring has clearance.
