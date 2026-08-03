## 1. Web Quick Entry

- [x] 1.1 Add a quick-entry-specific ready bridge message emitted only after the draft editor is mounted.
- [x] 1.2 Refactor creation-draft persistence so Add Checklist works before Summary is nonempty.
- [x] 1.3 Add outlined Cancel and filled primary Save actions and increase native quick-entry horizontal padding.
- [x] 1.4 Add React and bridge tests for readiness, empty-Summary checklist creation, action states, and spacing.

## 2. Native Panel Lifecycle

- [x] 2.1 Track per-presentation readiness separately from reusable document readiness and keep one native loading cover visible until the editor is ready.
- [x] 2.2 Make loading, ready, failed, and pending presentations immediately cancelable by Escape and the global shortcut with bounded web cleanup.
- [x] 2.3 Preserve native background dragging and present or dismiss the panel atomically without inner-content flicker.
- [x] 2.4 Add macOS and shared browser-model tests for readiness, cancellation, geometry, and movement policy.

## 3. Verification

- [x] 3.1 Run focused React, native Swift, lint, build, and OpenSpec validation checks.
- [x] 3.2 Exercise the ready quick-entry form in the local web surface and document any native-only behavior requiring manual app verification.
