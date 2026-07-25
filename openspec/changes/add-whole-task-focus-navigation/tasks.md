## 1. Interaction State Contract

- [x] 1.1 Add pure regression coverage for single focus, anchored multi-selection, and selection collapse
- [x] 1.2 Add shell coverage for distinct no-focus, focused, selected, and open-task states
- [x] 1.3 Add coverage for outside-click and view-navigation focus clearing

## 2. Whole-Row Keyboard Navigation

- [x] 2.1 Make each collapsed task card the only sequential keyboard focus target
- [x] 2.2 Implement wrapping Tab and Shift+Tab traversal plus bounded Up and Down traversal
- [x] 2.3 Preserve direct pointer behavior and modified-click behavior for links, completion, and actions
- [x] 2.4 Restore whole-row focus after close, movement, completion, and list projection changes

## 3. Pointer Selection And Commands

- [x] 3.1 Implement first-modified-click focus, anchored range selection, additive selection, and one-member collapse
- [x] 3.2 Extend command target resolution to one focused closed task
- [x] 3.3 Implement Open/Close Task toggle behavior and inline metadata opening from closed focus
- [x] 3.4 Extend Copy, Cut, Select All, and Duplicate behavior to the single-focus state
- [x] 3.5 Preserve nonwrapping Control+S and Control+W open traversal from closed focus

## 4. Presentation And Documentation

- [x] 4.1 Add whole-row focus styling and accessible state without exposing nested row controls to sequential Tab order
- [x] 4.2 Rename Close Task to Open/Close Task in the keyboard reference and update durable Tasks guidance
- [x] 4.3 Reconcile the durable personal-tasks-module specification with the revised focus contract
- [x] 4.4 Use one white whole-task focus outline across pointer, Tab, and arrow navigation

## 5. Validation

- [x] 5.1 Run focused interaction tests and resolve regressions
- [x] 5.2 Run the complete test, lint, typecheck, build, and strict OpenSpec suites
- [x] 5.3 Verify pointer, wrapping keyboard traversal, commands, focus restoration, and bulk threshold in the rendered Tasks app
- [x] 5.4 Verify consistent focused-row styling after Tab and arrow navigation

## 6. Accessible Granular And Space Navigation Revision

- [x] 6.1 Revise the proposal, design, and personal-tasks-module delta for native granular Tab traversal and distinct Space navigation
- [x] 6.2 Add regressions for task sub-control Tab order, leaving the list, initial Space focus, Space promotion, wrapped Space and arrow traversal, repeat suppression, and native Space preservation
- [x] 6.3 Implement granular task-summary Tab stops, logical whole-task focus separation, and wrapped Space and arrow movement
- [x] 6.4 Update the keyboard reference, human Tasks guide, and durable personal-tasks-module specification
- [x] 6.5 Run focused, full, build, lint, typecheck, strict OpenSpec, and rendered-browser validation

## 7. Bulk Actionability Convergence

- [x] 7.1 Add pure regression coverage for mixed, uniformly Waiting, uniformly Rechecking, and single-task actionability cycling
- [x] 7.2 Derive one actionability destination for every multi-task command and apply it consistently to all eligible targets
- [x] 7.3 Update the durable personal-tasks-module specification with the bulk convergence contract
- [x] 7.4 Run focused, full, lint, typecheck, build, strict OpenSpec, and rendered-browser validation

## 8. Escape And Action Focus Normalization

- [x] 8.1 Add regressions for Escape from granular and whole-task focus
- [x] 8.2 Route action-driven focus restoration through whole-task focus
- [x] 8.3 Update durable Tasks guidance and the personal-tasks-module specification
- [x] 8.4 Run focused, full, lint, typecheck, build, strict OpenSpec, and rendered-browser validation
