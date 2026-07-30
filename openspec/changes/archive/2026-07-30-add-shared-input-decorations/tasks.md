## 1. Shared Controls

- [x] 1.1 Add an optional noninteractive leading-decoration contract to the shared Input, Select trigger, and DatePickerField primitives
- [x] 1.2 Add focused tests for decoration rendering, accessible-name preservation, and collision-safe content spacing

## 2. Tasks Web Adoption

- [x] 2.1 Add canonical Tasks icon mappings for generic Primary Link, Deadline, Ready, Start, Area, and actionability decorations
- [x] 2.2 Decorate the Primary Link, Start, Deadline, Area, and Actionability controls in both existing-task and new-task editors
- [x] 2.3 Make the Start-picker Reminder full width with a Bell decoration and no visible label, and center Clear and Someday labels
- [x] 2.4 Keep the Primary Link launch button on ExternalLink while task-row and input identity use protocol-specific icons with Link2 as the default
- [x] 2.5 Update Tasks iconography and shared style documentation

## 3. iOS Widget Parity

- [x] 3.1 Change the generic widget Primary Link symbol to the native chain-link equivalent without changing routing
- [x] 3.2 Update native widget tests and documentation for the revised generic Primary Link identity

## 4. Verification

- [x] 4.1 Run focused shared-control, Tasks, and native mapping tests
- [x] 4.2 Run TypeScript, lint, build, and strict OpenSpec validation
- [x] 4.3 Verify the decorated metadata drawer and Start-picker layout in the local rendered application

## 5. Semantic Decoration And Completion Color Refinement

- [x] 5.1 Restore Today-horizon colors to Start decorations and apply purple to Waiting and Rechecking decorations
- [x] 5.2 Apply destructive red to Deadline decorations and values due today or earlier
- [x] 5.3 Remove green hover and checked-state color from task and checklist completion boxes
- [x] 5.4 Add focused tests for semantic decoration colors and neutral completion-box styling
- [x] 5.5 Run focused Tasks tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 5.6 Verify the refined metadata controls and completion boxes in the local rendered application
