## 1. Shared Command Foundation

- [x] 1.1 Add shared platform detection and form-command classification for Mac and Windows
- [x] 1.2 Replace the narrow global Command+Return listener with nearest-scope submit, cancel, and Return-opt-in handling
- [x] 1.3 Add shared declarative form-scope, submit, cancel, and Return-opt-in helpers
- [x] 1.4 Prove command precedence, validation, composition, disabled actions, portal scopes, and single-listener behavior with focused tests

## 2. Modal and Ordinary Form Behavior

- [x] 2.1 Update Dialog, AlertDialog, and Sheet primitives so plain Escape remains field-local and form commands use declared actions
- [x] 2.2 Preserve modal Tab containment, initial focus, trigger restoration, native button activation, and accessible names
- [x] 2.3 Audit native forms and non-form action scopes, adding explicit submit, cancel, and Return behavior without changing persistence semantics
- [x] 2.4 Enable Return submission for every gateway authentication form and retain required compact-form exceptions
- [x] 2.5 Verify ordinary text, textarea, number, email, password, time, URL, file, and color controls retain their specified native behavior

## 3. Composite Controls

- [x] 3.1 Align single-select and multi-select Space, Return, Escape, staged selection, reset, and Tab-exit behavior
- [x] 3.2 Make shared date pickers legal-focus, arrow-navigable, Space/Return-activatable, field-cancelable, and Tab-exiting
- [x] 3.3 Keep Tasks-specific Start horizons and reminder controls outside the shared date-picker implementation
- [x] 3.4 Add focused select, date-picker, file-input, and color-control regression coverage

## 4. DataGrid Interaction Contract

- [x] 4.1 Make DataGrid Tab and Shift+Tab commit, wrap across rows, skip unavailable cells, and exit at grid boundaries
- [x] 4.2 Keep focused/editing text-cell transitions consistent across text, number, currency, percentage, URL, and longtext cells
- [x] 4.3 Remove Left/Right boundary escape from editing text cells while preserving focused-mode spatial arrows
- [x] 4.4 Enforce explicitly declared legal Delete/Backspace reset targets for text, numeric, select, date, checkbox, and toggle cells
- [x] 4.5 Preserve pointer-origin editing, async-save focus restoration, optimistic values, sticky visibility, and low-judder scrolling
- [x] 4.6 Extend the shared DataGrid focus suite for traversal, editing, reset, composition, and async pointer cases

## 5. Tasks Integration

- [x] 5.1 Make the expanded task editor a shared autosaving form scope with revised Mac and Windows close commands
- [x] 5.2 Remove plain Escape task-editor closure while retaining field-level Escape for nested task controls
- [x] 5.3 Make Start and Deadline Tab-exit rather than internally Tab-traversed while preserving complete arrow navigation
- [x] 5.4 Update Tasks command classification, keyboard help, ARIA shortcut metadata, tests, and durable requirement wording

## 6. Documentation and Validation

- [x] 6.1 Update AGENTS.md and the human style guide with the final ordinary-form, modal, date-picker, DataGrid, reset, and shortcut policies
- [x] 6.2 Run focused interaction tests and repair every affected regression
- [x] 6.3 Run the complete test, lint, build, and strict OpenSpec validation suite
- [x] 6.4 Perform a repository-wide form/control audit and prove that every final requirement has direct evidence

## 7. Closeout

- [x] 7.1 Sync the form-control and Tasks deltas into durable specifications without contradictory legacy scenarios
- [x] 7.2 Archive the completed OpenSpec change and re-run strict validation
- [x] 7.3 Commit and push the verified implementation to main with a clean synchronized worktree
