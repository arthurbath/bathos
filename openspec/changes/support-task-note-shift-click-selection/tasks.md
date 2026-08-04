## 1. Shift-click Selection

- [x] 1.1 Resolve a primary-button Shift-click to an exact task-note source position using Chromium and WebKit caret APIs.
- [x] 1.2 Extend the existing logical anchor to the clicked position while preserving forward or backward direction through Markdown redecoration.
- [x] 1.3 Prevent a selection Shift-click from activating a decorated note link without changing ordinary link activation.

## 2. Regression Coverage

- [x] 2.1 Add component tests for forward and backward Shift-click selection across semantic Markdown lines.
- [x] 2.2 Add component coverage proving Shift-click does not activate a note link and ordinary pointer selection still works.

## 3. Validation

- [x] 3.1 Run the focused task-note test suite and TypeScript checks.
- [x] 3.2 Validate the gesture in the rendered Tasks app, including page identity, DOM health, console health, screenshot evidence, and interaction proof.
- [x] 3.3 Run lint, production build, full tests, and OpenSpec validation.
