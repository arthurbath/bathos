## 1. Task Editor Structure and Commands

- [x] 1.1 Reorder the shared task metadata drawer fields and update component tests for DOM, visual, and keyboard order
- [x] 1.2 Remove Summary Right Arrow handoff and add the Control+N Notes-focus command with keyboard tests
- [x] 1.3 Close an open Start picker after the direct Clear Start command while preserving closed-picker behavior

## 2. Task Persistence and List Reconciliation

- [x] 2.1 Centralize meaningful-task-content detection for Summary, Notes, Primary Link, and Checklist content
- [x] 2.2 Persist blank Summary values when other meaningful content exists and recoverably delete fully empty existing tasks on close
- [x] 2.3 Keep an open Today task anchored after clearing Start and reconcile it to Anytime only after close
- [x] 2.4 Add focused tests for blank-summary persistence, empty-close deletion, and Today-to-Anytime close reconciliation
- [x] 2.5 Preserve valid blank Summary strings while decoding authoritative task-history snapshots and add a regression test

## 3. Synchronization and List Metadata

- [x] 3.1 Trace the external-create path through PowerSync and native lifecycle observation using runtime and source evidence
- [x] 3.2 Repair native macOS live convergence and lifecycle recovery without introducing duplicate owner subscriptions
- [x] 3.3 Show far-future Upcoming Start month/day metadata in canonical order and add projection tests

## 4. Reminder and Apple Widget Presentation

- [x] 4.1 Prefix reminder toast bodies with the formatted reminder time and reduce the Reminder icon size
- [x] 4.2 Match iOS Lock Screen mini-widget task typography to the 13-point regular Calendar treatment
- [x] 4.3 Replace Apple large-widget empty-state checkmarks with the native Sparkles equivalent and center the group in the remaining body area
- [x] 4.4 Add or update reminder and native widget tests or source assertions

## 5. Verification

- [x] 5.1 Run focused Tasks web tests for editor, keyboard, persistence, list anchoring, synchronization, metadata, and reminder behavior
- [x] 5.2 Run the full web test, lint, build, and OpenSpec validation suites
- [x] 5.3 Build and test the iOS and macOS companion targets with signing disabled
- [x] 5.4 Audit all ten requested outcomes against implementation and evidence
