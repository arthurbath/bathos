## 1. Task Departure Feedback

- [x] 1.1 Add a pure departure classifier and neutral single/bulk toast presentation
- [x] 1.2 Report successful before-and-after metadata mutation batches from the task-list hook
- [x] 1.3 Wire immediate and deferred open-editor departure notices through the Tasks shell
- [x] 1.4 Add regressions for list moves, quick-filter exclusion, restored eligibility, bulk summaries, and visible edits

## 2. iOS Shake Undo

- [x] 2.1 Add one native web command event that invokes the existing task-and-checklist undo function
- [x] 2.2 Capture completed iOS shake motion in the Tasks web-view responder and dispatch the undo command
- [x] 2.3 Add web and native regressions for shake undo, boundary feedback, and non-shake motion

## 3. Validation

- [x] 3.1 Run focused Tasks web tests, iOS companion tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 3.2 Verify the rendered departure-toast workflow in the local Tasks application
