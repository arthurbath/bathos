## Context

Tasks currently anchors its Start and Deadline pickers to the task editor field or summary row that opened them. That placement is appropriate for pointer-driven desktop use, but the complete Start picker is taller than the visible area remaining above the iPhone software keyboard. The Reminder input can therefore remain hidden while it owns text focus.

BathOS already has a visual-viewport utility for modal surfaces, a shared mobile breakpoint, and centered popover placement for selection-mode temporal pickers. This change should reuse those foundations while continuing to render the established Start and Deadline picker panels. It must not fork their calendar, reminder, autosave, or keyboard behavior.

## Goals / Non-Goals

**Goals:**

- Detect the conjunction of a touch-capable device and a viewport below the BathOS mobile breakpoint.
- Present Task Start and Deadline pickers as centered modal popovers with the standard backdrop in that environment.
- Keep the centered surface within the current visual viewport and safe areas as a software keyboard opens or closes.
- Allow the picker itself to scroll when its complete content cannot fit, and keep a focused Reminder input visible.
- Preserve existing selection, dismissal, nested Reminder menu, focus restoration, and autosave behavior.
- Keep the current anchored placement everywhere else.

**Non-Goals:**

- Replacing the shared calendars, reminder input, or reminder-hour menu.
- Turning the temporal pickers into full-screen Dialog components or bottom sheets.
- Changing the BathOS mobile breakpoint or general modal layout policy.
- Changing recurrence date pickers, DataGrid date controls, or native Swift UI.
- Adding database, synchronization, or migration work.

## Decisions

### Use one shared responsive presentation decision

A shared hook will determine whether a temporal popover should use mobile modal presentation. It will require both a mobile-width media query and touch capability reported by either `navigator.maxTouchPoints` or a coarse primary pointer. The hook will observe media-query and viewport changes so rotation and responsive resizing update the presentation without a reload.

This avoids user-agent detection and preserves anchored popovers on narrow desktop windows. It also supports hybrid touch devices without treating every wide tablet layout as mobile.

### Reuse the existing picker panels inside a modal popover shell

The Start and Deadline fields will continue rendering their existing popover content. At mobile touch width, the popover root becomes modal, a standard backdrop is rendered behind it, and its anchor is placed at the center of the visible viewport. At all other widths the current trigger-relative anchor remains unchanged.

Using the same panel prevents functional drift between mobile and desktop. A full BathOS Dialog is not used because mobile Dialogs intentionally become edge-to-edge, while this picker needs to remain a compact floating surface.

### Follow the visual viewport and scroll only the picker when necessary

The centered anchor and popover surface will consume the existing visual-viewport CSS variables. The content receives a safe-area-aware maximum height, `overscroll-contain`, and internal vertical scrolling. When the Reminder input is focused, visual-viewport resize or scroll events will ensure that input remains within the popover's visible scrollport.

This treats the software keyboard as a change to the visible viewport rather than guessing its height. Browsers without `window.visualViewport` continue using the existing window-height fallback.

### Preserve dismissal and focus contracts

The modal backdrop blocks interaction with the task list and dismisses the picker through the same controlled open-state path as ordinary outside dismissal. Closing continues to restore focus to the initiating control where the existing field contract requires it. Reminder input blur and commit behavior remains owned by the existing Start picker panel, including when backdrop dismissal begins from that field.

The Reminder hour menu remains a nested popover above the Start picker. Dismissing that nested menu must not dismiss the parent picker.

## Risks / Trade-offs

- **Nested portal ordering:** The modal backdrop could cover the Reminder hour menu. Mitigation: retain the shared popover content stacking level above the backdrop and test nested menu interaction in the centered mode.
- **Keyboard animation timing:** iOS may emit several visual-viewport events while animating the keyboard. Mitigation: coalesce visibility correction through animation frames and calculate against the current scrollport each time.
- **Background scroll leakage:** A custom backdrop alone would not prevent all touch scrolling. Mitigation: use the popover's modal mode and overscroll containment while the centered presentation is active.
- **Hybrid-device classification:** `maxTouchPoints` may remain positive while a mouse is in use. This is acceptable because the mobile-width condition must also be true, and the modal presentation remains fully pointer-operable.
- **Very short visible viewport:** The full picker may not fit even after centering. Mitigation: preserve fixed outer placement and scroll the content internally rather than resizing calendar controls or allowing the page behind it to move.
