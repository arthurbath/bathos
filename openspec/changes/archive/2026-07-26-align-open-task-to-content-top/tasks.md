## 1. Scroll Contract

- [x] 1.1 Expose a stable rendered boundary for the sticky BathOS topline header
- [x] 1.2 Replace minimal Summary reveal scrolling with best-effort summary-row top alignment
- [x] 1.3 Preserve smooth disclosure motion and immediate reduced-motion alignment
- [x] 1.4 Defer ordinary-motion alignment until the expansion reaches its final layout height

## 2. Verification

- [x] 2.1 Add focused regression coverage for sticky-boundary alignment and scroll behavior
- [x] 2.2 Exercise the rendered task-opening flow and verify viewport-independent sticky-boundary measurement
- [x] 2.3 Run Tasks tests, type checking, lint, build, full tests, performance checks, and OpenSpec validation
- [x] 2.4 Prove scrolling does not begin during expansion and rerun rendered and automated validation
