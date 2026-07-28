## Context

Tasks already has one selection state shared by modified-click entry, the explicit Lasso action, circular selection controls, keyboard commands, bulk planning, and native grouped drag-and-drop. Task rows currently treat an ordinary activation click during selection mode as a request to leave selection and open the task, and no touch gesture begins selection directly from a row.

The new interaction must preserve native vertical scrolling and Safari edge navigation, must never activate from mouse, trackpad, or pen input, and must not introduce the custom pointer drag or custom scrolling systems that Tasks intentionally avoids.

## Goals / Non-Goals

**Goals:**

- Recognize a deliberate left swipe from an actual touch pointer on a task summary row.
- Enter the existing selection state with the swiped task selected.
- Make ordinary summary-row activation toggle selection membership while selection mode is active.
- Keep native group drag-and-drop as the only task reordering mechanism.
- Prevent a completed swipe from also firing the row's ordinary click or completion action.

**Non-Goals:**

- Device classification based on viewport width or coarse-pointer media queries.
- Mouse, trackpad, or pen swipe gestures.
- A custom touch drag engine, custom drag autoscrolling, or a JavaScript drag preview.
- Reordering Done tasks.
- Swipe action trays, destructive swipe actions, or continuous row-following animation.

## Decisions

### Gate by the active pointer rather than the device

The gesture will begin only when a `PointerEvent` reports `pointerType === "touch"`. This lets a finger use the gesture on a hybrid device while the same device's mouse, trackpad, or pen retains ordinary behavior.

### Recognize on release after directional qualification

The task summary header will record the touch pointer's start and latest coordinates. Selection occurs on pointer release only when:

- horizontal displacement is at least 48 CSS pixels to the left;
- horizontal displacement is at least 1.25 times the absolute vertical displacement; and
- the gesture did not begin within 24 CSS pixels of either viewport edge.

The summary header will declare `touch-action: pan-y`, leaving vertical panning native while reserving deliberate horizontal movement for the application. Pointer cancellation abandons the gesture.

### Reuse the existing selection transition

A qualifying swipe will close any open editor through the established autosave boundary, clear lightweight focus, establish the swiped task as the range anchor, and enter bulk mode with exactly that task selected. The same transition applies to active and Done lists, although Done remains non-reorderable.

### Suppress the synthetic click after a swipe

The task header will consume the click synthesized after a recognized swipe so the newly selected task is not immediately deselected and its completion control is not activated.

### Make row activation selection-owned during selection mode

While bulk mode is active, an ordinary activation of any task summary toggles that task using the same unmodified selection gesture as the circular control. Deselecting the final task keeps the established automatic exit behavior. Opening a task requires leaving selection mode first.

### Keep native group dragging

Selected tasks retain the existing HTML `draggable` summary surface and grouped drop transaction. No pointer-driven drag fallback will be added. Actual iPhone PWA acceptance will establish whether the target WebKit runtime begins the native drag reliably from a touch hold.

## Risks / Trade-offs

- **Browser-owned edge navigation can preempt the gesture** → Ignore starts within the 24-pixel edge guard and do not attempt to override browser navigation.
- **A diagonal scroll could be mistaken for selection** → Require leftward distance, horizontal dominance, and completion on release.
- **A synthesized click could reverse the selection** → Consume the next header click after a qualifying swipe.
- **Native touch drag initiation varies by runtime** → Keep the visible Lasso entry and bulk controls available, avoid a custom fallback, and perform final acceptance on the installed iPhone PWA.
- **Changing row activation removes direct task opening from selection mode** → Make this deliberate and universal so every row-sized target behaves consistently for touch and pointer users.
