## 1. Shared Picker Surfaces

- [x] 1.1 Extract reusable controlled Deadline calendar content without changing the existing `DatePickerField` contract.
- [x] 1.2 Expose a chrome-free controlled Start picker surface for row-anchored and viewport-centered placement.
- [x] 1.3 Add a row-targeted temporal picker command bridge that preserves open-Start advancement.

## 2. Task Actions and Commands

- [x] 2.1 Replace the active task ellipsis menu with Start, Deadline, Area, Actionability, Repeat, and Delete.
- [x] 2.2 Implement row alignment and summary-anchored single-task Start and Deadline pickers.
- [x] 2.3 Replace bulk Start and Deadline modal fields with centered shared picker content.
- [x] 2.4 Route focused-task Control+E and Control+D through the anchored row surfaces without opening the metadata drawer.

## 3. Verification

- [x] 3.1 Add or update focused tests for menu contents, submenus, picker reuse, positioning modes, keyboard commands, persistence, and focus relinquishment.
- [x] 3.2 Run affected tests, the full test suite, TypeScript, lint, build, and strict OpenSpec validation.
- [x] 3.3 Verify the task menu and anchored and centered temporal picker behavior in the rendered local application.
