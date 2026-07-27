## 1. Shared Interaction And Iconography

- [x] 1.1 Reverse the shared single-line Return policy while preserving textarea, composition, field-owned composite, opt-out, and Command+Return behavior
- [x] 1.2 Update affected shared-form tests, project guidance, and human style documentation
- [x] 1.3 Apply and document the canonical Someday, completed task, add, and Today Lucide icons

## 2. Checklist Interaction

- [x] 2.1 Add owner-scoped reactive checklist hooks and repository operations for create, edit, complete, delete, cleanup, and reorder
- [x] 2.2 Add the inline checklist editor to the expanded task drawer with autosave, keyboard traversal, Backspace deletion, close-time cleanup, and drag handles
- [x] 2.3 Wire the checklist keyboard command and smooth completion-to-bottom movement
- [x] 2.4 Extend guarded undo and redo to checklist creation, editing, completion, deletion, and reorder
- [x] 2.5 Add checklist domain, repository, keyboard, rendered component, synchronization, and convergence tests

## 3. Repeating Tasks

- [x] 3.1 Add a forward recurrence migration for structured calendar rules, end conditions, reminder inheritance, Deadline offsets, adopted occurrences, and guarded terminal editing
- [x] 3.2 Update generated types, PowerSync upload parsing, task portability, and database assertions without changing the 20-table publication
- [x] 3.3 Implement recurrence date calculation, bounded preview, adoption, save, status, and evaluation services
- [x] 3.4 Build the keyboard-accessible Repeat dialog for after-completion, daily, weekly, monthly, and yearly rules
- [x] 3.5 Add Repeat actions and recurrence state to ordinary and terminal task drawers
- [x] 3.6 Render calendar occurrences in Upcoming and waiting after-completion definitions in a non-draggable Repeating Tasks section
- [x] 3.7 Add recurrence unit, database, timezone, idempotency, end-condition, reminder, Deadline-offset, and rendered acceptance tests

## 4. Deletion And Done

- [x] 4.1 Add Delete to task menus and implement open, focused, selected, and guarded bulk keyboard deletion commands
- [x] 4.2 Make completed, canceled, and deleted task rows openable, editable, focusable, selectable, and jointly recoverable
- [x] 4.3 Route recovery by current planning metadata while preserving terminal grouping and retention timestamps
- [x] 4.4 Group Done by owner-local terminal-entry day and prohibit every Done drag-reorder path
- [x] 4.5 Add lifecycle, history, menu, keyboard, bulk, recovery, grouping, terminal-editing, and no-drag tests

## 5. Validation And Handoff

- [x] 5.1 Run Supabase database tests and lint, the full application suite, TypeScript, lint, build, and strict OpenSpec validation
- [x] 5.2 Verify rendered desktop and mobile checklist, recurrence, deletion, Done, icon, and Return behavior in the real browser
- [x] 5.3 Verify offline persistence, PowerSync schema parity at exactly 20 tables, cron compatibility, and production-readiness evidence
- [x] 5.4 Record assumptions, remaining questions, exact production approval text, and project-removal closeout status in the morning report
