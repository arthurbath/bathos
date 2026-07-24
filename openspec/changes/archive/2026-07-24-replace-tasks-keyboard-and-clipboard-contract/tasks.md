## 1. Keyboard Contract

- [x] 1.1 Replace the Tasks keyboard command domain with the approved Mac Command, Mac Control, Windows Control, and Windows Control+Shift maps, including collision handling and removed Find, Projects, Templates, and numeric navigation shortcuts
- [x] 1.2 Update capture-phase dispatch, editable-control precedence, platform command targeting, form close, list traversal, planning, lifecycle, and view navigation behavior
- [x] 1.3 Update the visible Keyboard Commands reference to match the complete runtime map and reserved checklist command
- [x] 1.4 Add focused parser and dispatch tests for exact chords, native-preservation contexts, active composition, Mac/Windows parity, and Windows Redo/Close separation

## 2. Structured Clipboard

- [x] 2.1 Add a bounded versioned task clipboard schema, strict serializer/parser, reconstructible task snapshot loading, and plain-text fallback
- [x] 2.2 Add Copy and clipboard-first recoverable Cut for selected present tasks, nondestructive Copy from Done, terminal Cut rejection, selection cleanup, and outcome notifications
- [x] 2.3 Implement destination-aware Paste for Today, Anytime, Someday, project detail, and area detail with rejection elsewhere, planning normalization, top insertion, and stable payload order
- [x] 2.4 Reconstruct checklist, reminder, and supported recurrence intent with fresh identities, connected-boundary preflight, and recoverable compensation on partial failure
- [x] 2.5 Add domain and component tests for malformed payloads, menu clipboard events, editable native behavior, destination transformation, reminder legality, source order, and failure safety

## 3. Duplication and Selection

- [x] 3.1 Deepen Duplicate to include all reconstructible user-authored task state while excluding immutable identity, provenance, history, and terminal state
- [x] 3.2 Make single-open-task Duplicate close the original and open/focus the duplicate, and preserve deterministic multi-selection behavior
- [x] 3.3 Extend selection semantics and accessibility to Done task rows for Copy and Duplicate while withholding Cut and open-task planning
- [x] 3.4 Add regression tests for open-task, multi-selection, project/area, checklist, reminder, recurrence, and Done duplication

## 4. Editor Motion

- [x] 4.1 Sequence task-editor mount, collapsed paint, expansion, title focus, and minimal reveal scrolling while preserving the close animation
- [x] 4.2 Verify reduced-motion behavior and add focused disclosure/focus/scroll regression coverage

## 5. Validation and Closeout

- [x] 5.1 Run focused Tasks tests and repair every regression
- [x] 5.2 Run the full test suite, lint, production build, and strict OpenSpec validation
- [x] 5.3 Perform rendered Mac/browser QA for keyboard ownership, clipboard persistence, selection, destination behavior, responsive layout, motion, accessibility, and console health
- [x] 5.4 Synchronize the durable personal-tasks-module spec, archive the completed change, and rerun full validation
- [x] 5.5 Commit and push main, then verify a clean synchronized worktree and audit every approved requirement against evidence
