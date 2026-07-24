## 1. Expanded Editor Layout

- [x] 1.1 Remove the redundant editor divider, excess top padding, and desktop indentation while preserving responsive card padding
- [x] 1.2 Reorder editor controls to Summary, Title, Notes, Primary Link, Start, Deadline, Actionability, and Organization

## 2. BathOS Form Controls

- [x] 2.1 Replace native Actionability and Organization selects with shared BathOS Select components
- [x] 2.2 Align the Notes surface with shared BathOS input border and focus styling
- [x] 2.3 Convert Primary Link to the standard URL-input treatment with an adjacent open-link control and no clear button

## 3. Regression Coverage

- [x] 3.1 Update Tasks component tests for editor structure, field order, select behavior, URL behavior, and keyboard traversal
- [x] 3.2 Run focused tests, the complete suite, lint, build, and strict OpenSpec validation

## 4. Rendered QA and Closeout

- [x] 4.1 Verify desktop and narrow expanded-editor layout, control styling, popovers, link action, focus order, and console health
- [x] 4.2 Sync and archive the OpenSpec change, then commit and push the verified implementation
