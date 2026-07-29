## 1. Query Settlement

- [x] 1.1 Expose watched-query fetching state from the Tasks list hook without changing existing initial loading behavior.
- [x] 1.2 Cover the query-status contract with a focused hook test.

## 2. Route Transition Presentation

- [x] 2.1 Track list-to-list route settlement in the Tasks shell and conceal stale rows before paint.
- [x] 2.2 Present the existing Tasks spinner for a short minimum interval until the destination query settles.
- [x] 2.3 Keep same-view query re-evaluation visible without activating the route-transition loading state.

## 3. Verification

- [x] 3.1 Add shell coverage for route-driven loading and settled destination presentation.
- [x] 3.2 Run focused tests, the full test suite, lint, build, and strict OpenSpec validation.
- [x] 3.3 Verify pointer and keyboard list navigation in the rendered local app with no intermediate row replacement or console errors.
