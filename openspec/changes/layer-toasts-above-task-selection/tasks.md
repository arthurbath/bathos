## 1. Selection Layering

- [x] 1.1 Lower the fixed Tasks selection-mode bar beneath the shared toast viewport while preserving its placement and behavior.
- [x] 1.2 Add regression coverage for the toast-over-selection stacking relationship.
- [x] 1.3 Place Dialog and AlertDialog backdrops below both shared toast systems while preserving modal content and mobile navigation above them.
- [x] 1.4 Extend regression coverage to enforce the complete selection, backdrop, toast, navigation, and modal-content hierarchy.

## 2. Validation

- [x] 2.1 Run focused automated checks, lint/build, and OpenSpec validation.
- [x] 2.2 Verify the live toast viewport layers above the selection-mode bar in the rendered Tasks UI without relevant console errors.
- [x] 2.3 Verify the rendered modal backdrop and automated toast layers preserve the required order without relevant console errors.
