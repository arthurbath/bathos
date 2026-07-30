## 1. Shared Mobile Navigation

- [x] 1.1 Distinguish native, standalone, and ordinary mobile-web bottom offsets in `MobileBottomNav`.
- [x] 1.2 Reduce outer and destination padding while preserving equal tracks, touch height, gapless layout, and outer width.
- [x] 1.3 Scope lower-boundary overscroll suppression to installed touch navigation and clean it up on unmount.
- [x] 1.4 Extend shared navigation tests for offset classes, padding, and installed overscroll scope.

## 2. Tasks Native Editing Surfaces

- [x] 2.1 Add explicit native Summary capture focus styling and a synchronized end-caret presentation that yields to direct WebKit editing.
- [x] 2.2 Apply one semantic darker background to the complete open task while preserving closed, keyboard-focus, and bulk-selection colors.
- [x] 2.3 Extend Tasks tests for native focus presentation, pointer handoff, and the unified open-task surface.

## 3. Validation

- [x] 3.1 Run focused shared-navigation, Tasks, and native companion tests.
- [x] 3.2 Run Tasks typecheck, lint, production build, strict OpenSpec validation, and diff hygiene.
- [x] 3.3 Verify the rendered Tasks flow at a mobile viewport, including navigation placement and bottom-scroll stability, open-task contrast, new-task focus, and console health; verify the native and standalone offset contracts with focused component tests.
