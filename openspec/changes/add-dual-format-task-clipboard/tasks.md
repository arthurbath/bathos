## 1. Clipboard Representations

- [x] 1.1 Add bounded task and checklist helpers that derive readable plain text, compatible HTML metadata, and private MIME payloads from the existing versioned envelopes.
- [x] 1.2 Update task Copy and Cut to write the dual-format representations without changing deletion or reconstruction behavior.
- [x] 1.3 Update checklist-item Copy and Cut to write the dual-format representations without changing selection or deletion behavior.

## 2. Paste Resolution

- [x] 2.1 Make task paste prefer private or HTML-embedded BathOS data before plain text while accepting legacy JSON-only clipboard content.
- [x] 2.2 Apply the same structured-first resolution to checklist-item paste at saved and draft insertion points.

## 3. Verification

- [x] 3.1 Add unit and component coverage for readable external text, full-fidelity internal task/checklist paste, browser fallbacks, and legacy payload compatibility.
- [x] 3.2 Validate Copy/Paste behavior in the rendered Tasks app and inspect page, DOM, console, and screenshot evidence.
- [x] 3.3 Run Tasks TypeScript checks, lint, production build, full tests, and strict OpenSpec validation.
