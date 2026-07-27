## Context

The task editor already separates title focus from scrolling by focusing with `preventScroll`, then performing a delayed smooth reveal as the disclosure opens. That reveal currently targets the Summary input with `block: nearest`, so it stops as soon as the field is barely visible and leaves avoidable portions of the editor below the viewport. The sticky BathOS topline header also means raw viewport-top alignment would conceal the summary row.

## Goals / Non-Goals

**Goals:**

- Align the opened task's summary row with the visible content boundary below the sticky topline header.
- Use all available document scroll range and accept browser clamping near the end of short lists.
- Preserve title focus, disclosure motion, and reduced-motion behavior.

**Non-Goals:**

- Introduce a nested Tasks scroll container.
- Resize, collapse, or otherwise alter editor content to force the entire drawer onscreen.
- Change closed-task focus navigation or its minimal `block: nearest` reveal behavior.

## Decisions

1. Mark the shared topline header with a stable data attribute and measure its rendered bottom edge. This accounts for desktop, mobile, and standalone safe-area height without copying a fixed pixel offset into Tasks.
2. Measure the task's summary row and use `window.scrollBy` for the difference between its top and the header's bottom. The browser naturally clamps the request at the document boundaries, which produces the required best-effort behavior on short lists.
3. Keep the existing `preventScroll` title focus, then perform the explicit task-row alignment in the disclosure sequence. Reduced motion uses immediate scrolling. Ordinary motion waits for the full editor expansion duration, then measures and scrolls on the next animation frame so the final drawer height and document scroll range are available.

## Risks / Trade-offs

- [Risk] A missing header marker could make the task align to the raw viewport top. → Fall back to a zero boundary while retaining functional best-effort reveal.
- [Risk] Layout can continue moving during disclosure. → Wait for the expansion transition to finish, measure on the following animation frame, cancel delayed work if selection changes, and cover both the delay and requested scroll target in regression and rendered browser tests.
- [Trade-off] The task can still be only partially visible when the document has reached its maximum scroll. → This is intentional and exposes the greatest possible portion without artificial filler beyond the existing list clearance.
