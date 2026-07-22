## 1. Audit and Contract

- [x] 1.1 Capture current desktop and mobile Tasks screenshots and record the graphical, UX, and accessibility audit
- [x] 1.2 Validate the change artifacts and confirm the implementation diff remains limited to Tasks and backward-compatible shared navigation

## 2. Shared Mobile Navigation

- [x] 2.1 Add optional real-link overflow-menu support to `MobileBottomNav` without changing existing consumers
- [x] 2.2 Add shared navigation tests for the existing direct-item path, the five-destination overflow path, active state, keyboard access, and modified clicks

## 3. Tasks Navigation and Config

- [x] 3.1 Register `/tasks/config` and divide Tasks destinations into four primary views plus More
- [x] 3.2 Replace the nine-column desktop strip and seven-item mobile bar with the shared compact hierarchy
- [x] 3.3 Add the Config page and move Browser Reminders, Synchronization, and Backup and Restore into concise maintenance sections
- [x] 3.4 Remove persistent maintenance controls, browser-reminder capability, and duplicate Projects/Templates shortcuts from daily views
- [x] 3.5 Use the active route label as the page heading at every viewport and preserve keyboard navigation shortcuts

## 4. Progressive Hierarchy Creation

- [x] 4.1 Replace permanent Projects creation fields with compact Add Area and Add Project icon buttons
- [x] 4.2 Add title-only keyboard-complete area and project dialogs with required-field treatment and focus restoration
- [x] 4.3 Extend focused Projects tests for dialog submission, cancellation, optional area choice, and accessible controls

## 5. Validation and Handoff

- [x] 5.1 Run focused Tasks and shared navigation tests, the full test suite, lint, production build, and strict OpenSpec validation
- [x] 5.2 Capture and inspect after screenshots at 1,440 by 900 and 390 by 844, including daily navigation, More, Config, and Projects
- [x] 5.3 Update the audit with before/after findings, sync and archive the change, commit, push, and confirm a clean synchronized repository
