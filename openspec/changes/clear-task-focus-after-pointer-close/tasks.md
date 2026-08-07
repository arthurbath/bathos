## 1. Interaction Tracing

- [x] 1.1 Trace ordinary-task and recurrence-prototype summary-row closure through shared close and focus-restoration orchestration.
- [x] 1.2 Identify the keyboard Open/Close Task path and preserve its surviving-row fallback behavior.

## 2. Focus Intent Implementation

- [x] 2.1 Pass explicit pointer clear-focus intent through ordinary-task summary-row closure.
- [x] 2.2 Apply equivalent pointer clear-focus behavior to recurrence prototypes when their activation path differs.
- [x] 2.3 Preserve whole-task focus restoration for keyboard-command closure.

## 3. Verification

- [x] 3.1 Add regression tests proving pointer closure clears lightweight and DOM focus.
- [x] 3.2 Add regression tests proving keyboard closure retains focus on the freshly closed task or fallback.
- [x] 3.3 Run focused Tasks tests, lint, build, and strict OpenSpec validation.
