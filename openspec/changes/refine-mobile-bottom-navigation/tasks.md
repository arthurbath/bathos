## 1. Shared Mobile Navigation

- [x] 1.1 Refine the outer navigation to use complete pill geometry, a low-contrast semantic border, and a subtly translucent blurred background.
- [x] 1.2 Detect installed iOS contexts and reduce only their additional bottom margin while preserving the full safe-area inset.
- [x] 1.3 Reclaim horizontal active-pill space by reducing inter-destination spacing and remove mobile hover-color treatment.
- [x] 1.4 Remove the remaining inter-destination gap and remove the extra installed touch-device bottom margin while preserving ordinary web placement.

## 2. Verification

- [x] 2.1 Add focused shared-component tests for ordinary mobile web, native iOS, and standalone iOS presentation contracts.
- [x] 2.2 Verify the rendered mobile navigation geometry, background treatment, placement, and navigation interaction without relevant console errors.
- [x] 2.3 Run focused tests, Tasks typecheck, lint, production build, and strict OpenSpec validation.
- [x] 2.4 Add focused class-contract coverage for the reduced grid gap and absent hover treatment.
- [x] 2.5 Verify the longest active label at an iPhone-width rendered geometry, then rerun focused tests, Tasks typecheck, lint, build, and strict OpenSpec validation.
- [x] 2.6 Extend focused coverage for gapless destination tracks and native, standalone, and ordinary-web bottom placement.
- [x] 2.7 Verify the refined iPhone-width rendering, then rerun focused tests, Tasks typecheck, lint, build, strict OpenSpec validation, and diff hygiene.

## 3. Desktop Installed Chrome

- [x] 3.1 Omit the safe-area header spacer entirely from non-touch installed desktop PWAs.
- [x] 3.2 Add focused regression coverage and verify the installed desktop presentation.
