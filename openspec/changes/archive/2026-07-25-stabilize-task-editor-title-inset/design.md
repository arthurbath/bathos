## Context

The task editor disclosure animates its grid row from collapsed to expanded. Its previous `padding-top: 4px` became part of the form's intrinsic layout height, so that inset could become visible as a late second phase after the principal drawer expansion.

## Goals / Non-Goals

**Goals:**

- Preserve four visible pixels between the summary row and Title.
- Keep the inset constant while the disclosure height changes.
- Avoid changing field order, field-to-field gaps, or the editor's autosave behavior.

**Non-Goals:**

- Redesigning the disclosure transition.
- Changing the duration or easing of task motion.
- Changing editor metadata controls or persistence.

## Decisions

The editor form will use a four-pixel CSS transform rather than top padding or margin. A transform changes the painted position without contributing to intrinsic layout height, so the disclosure has one stable height to animate. The existing bottom padding provides enough room for the transformed content without clipping.

Adding a spacer, margin, or padding was rejected because each contributes to measured layout height and can recreate the observed second phase. Moving only the Title field was rejected because it would alter the gap between Title and Notes unless additional compensating layout rules were introduced.

## Risks / Trade-offs

- A transformed form paints four pixels lower than its layout box and effectively consumes four pixels of its existing bottom padding. The editor retains eight pixels of visible bottom padding, so no control is clipped.
- Browser compositing can vary slightly, so rendered verification will sample the visual inset during the live transition in addition to component regression tests.
