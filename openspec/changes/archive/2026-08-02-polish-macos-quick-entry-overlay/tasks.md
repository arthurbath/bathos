## 1. Native Panel Presentation

- [x] 1.1 Apply the rounded content mask, one-pixel dark-gray border, transparent window background, and native panel shadow.
- [x] 1.2 Add native tests for the Quick Entry panel presentation policy.

## 2. Quick Entry Interaction and Layout

- [x] 2.1 Increase only the Quick Entry editor's horizontal page padding.
- [x] 2.2 Prevent interior background clicks from invoking the ordinary open-task outside-click close behavior.
- [x] 2.3 Add React regression coverage for panel-background clicks and Quick Entry padding.

## 3. Unified Loading and Warm Reuse

- [x] 3.1 Add a versioned native content-ready bridge message for the authenticated Tasks shell and settled authentication surface.
- [x] 3.2 Keep the native loading presentation active until meaningful web readiness, with a bounded compatibility fallback.
- [x] 3.3 Reuse an already ready Quick Entry document with same-document routing instead of a full page reload.
- [x] 3.4 Extend native and web bridge tests for readiness, fallback, and warm Quick Entry reuse.

## 4. Validation

- [x] 4.1 Run focused React tests, Tasks TypeScript checking, lint, and production build.
- [x] 4.2 Run focused native tests and the unsigned macOS build.
- [x] 4.3 Validate the local rendered Tasks surface and strict OpenSpec rules.
