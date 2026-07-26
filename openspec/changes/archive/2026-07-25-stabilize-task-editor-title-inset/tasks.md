## 1. Stable Title Inset

- [x] 1.1 Replace the layout-based task editor top inset with a four-pixel visual offset that does not affect intrinsic disclosure height
- [x] 1.2 Update component regression coverage to require the non-layout offset and reject top padding or margin

## 2. Validation

- [x] 2.1 Run focused Tasks tests, Tasks type checking, lint, build, and OpenSpec validation
- [x] 2.2 Replay the rendered task-opening flow and verify a steady four-pixel inset without a second expansion step
