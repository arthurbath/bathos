## 1. Clipboard Planning

- [x] 1.1 Add line-ending normalization and pure task/checklist multiline paste planning with domain tests
- [x] 1.2 Extend ordinary task paste to create one destination-aware task per nonempty source line while preserving structured payloads

## 2. Checklist Editing

- [x] 2.1 Add deterministic ordered batch creation to the checklist data hook with focused tests
- [x] 2.2 Handle persisted and draft checklist multiline paste at the active selection, restore final caret focus, and preserve single-line native paste
- [x] 2.3 Cover LF, CRLF, bare CR, rich clipboard plain text, selection replacement, order, and focus in component tests

## 3. Verification

- [x] 3.1 Run focused Tasks tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 3.2 Verify list and checklist paste behavior in the rendered local Tasks app, including console health

## 4. Structured Checklist Clipboard

- [x] 4.1 Add a strict versioned checklist-item clipboard envelope with serialization, parsing, size and count guards, and domain tests
- [x] 4.2 Let active checklist selection own Copy and Cut, preserve visual order and completion state, protect source rows on clipboard failure, and emit task-parity toasts
- [x] 4.3 Paste structured checklist items at persisted and draft checklist positions with deterministic order, preserved completion state, final-row focus, silent success, and failure toasts
- [x] 4.4 Cover cross-task copy, cut, paste, malformed payload, clipboard ownership, insertion position, status preservation, and feedback behavior in focused tests
- [x] 4.5 Remove redundant success toasts from task and checklist Paste while preserving all Paste failure notifications

## 5. Structured Checklist Verification

- [x] 5.1 Run focused Tasks tests, Tasks TypeScript, targeted lint, build, and strict OpenSpec validation
- [x] 5.2 Smoke-check the rendered task editor without mutating the user's live task data

## 6. Checklist Creation Regression

- [x] 6.1 Restore the checklist undo-operation column to the PowerSync client schema and guard it with schema coverage
- [x] 6.2 Register checklist drafts with the task-editor flush boundary so Return and close durably preserve new checklist items
- [x] 6.3 Add focused regression coverage for Return-created following items and close-time draft persistence
- [x] 6.4 Run focused tests, Tasks TypeScript, targeted lint, build, strict OpenSpec validation, and a rendered non-mutating smoke check

## 7. Checklist Completion Regression

- [x] 7.1 Cover checklist completion through the production repository and PowerSync schema, including database reopen persistence
- [x] 7.2 Accept checklist undo-operation identifiers through the PowerSync upload path and cover the parsed remote update
- [x] 7.3 Run focused checklist tests, Tasks TypeScript, lint, build, strict OpenSpec validation, and rendered checklist interaction QA
