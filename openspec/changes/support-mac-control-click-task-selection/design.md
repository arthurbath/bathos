## Context

Tasks centralizes modified-click selection state in `taskSelection.ts`, while row components own the pointer events that reach that domain helper. On macOS, Control-click is also the system gesture for opening a context menu, so modifier recognition alone is insufficient: eligible to-do activation surfaces must claim the gesture without allowing a second pointer event to toggle the selection back.

## Goals / Non-Goals

**Goals:**

- Give macOS Control-click exact selection parity with macOS Command-click on eligible to-do rows.
- Handle the gesture once and suppress the native context menu for that handled row gesture.
- Retain the existing selection anchor, open-editor closing, and active-selection toggle behavior.

**Non-Goals:**

- Replacing Command-click or changing Windows modifier behavior.
- Suppressing Control-click context menus outside eligible to-do activation surfaces.
- Changing drag-and-drop, ordinary-click, or keyboard selection behavior.

## Decisions

- The selection domain will regard either `metaKey` or `ctrlKey` as the Mac modified-click signal. This keeps the state transition identical for both gestures.
- Eligible row activation surfaces will claim Mac Control-left-click on pointer down, ignore the corresponding click activation, and prevent the resulting context menu. Handling on pointer down avoids browser differences in whether a Control-click later emits `click`, `contextmenu`, or both.
- The interception will remain scoped to each selectable to-do activation surface. Links, controls, popovers, and non-task surfaces retain their native Control-click behavior.

## Risks / Trade-offs

- **Risk:** A handled pointer-down could be followed by click or context-menu events and toggle twice. **Mitigation:** ordinary click activation ignores the Mac Control-click gesture, while the context-menu handler only suppresses the browser menu.
- **Risk:** Interception could block useful context menus on nested controls. **Mitigation:** existing control event propagation boundaries remain intact and coverage verifies the task activation surface rather than applying a document-level listener.
