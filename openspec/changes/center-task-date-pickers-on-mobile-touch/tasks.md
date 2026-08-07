## 1. Shared responsive popover foundation

- [x] 1.1 Add a shared reactive detector for touch-capable viewports below the BathOS mobile breakpoint.
- [x] 1.2 Add a reusable modal-popover backdrop and visible-viewport-centered placement treatment with safe-area-aware internal scrolling.

## 2. Tasks temporal picker integration

- [x] 2.1 Select centered modal placement for ordinary Task Start and Deadline fields only on mobile touch viewports, preserving all existing anchored and selection-mode placements elsewhere.
- [x] 2.2 Keep the focused Start Reminder input visible as the visual viewport changes for the software keyboard.
- [x] 2.3 Preserve backdrop dismissal, focus restoration, Reminder commit, and nested Reminder hour-menu behavior.

## 3. Verification

- [x] 3.1 Add unit and interaction coverage for responsive placement, backdrop behavior, visual-viewport sizing, and focused Reminder visibility.
- [x] 3.2 Run targeted Tasks and shared UI tests, lint, production build, and OpenSpec validation.
- [ ] 3.3 Verify the centered picker and keyboard-constrained state in the rendered Tasks interface at mobile width, plus anchored behavior at desktop width.
