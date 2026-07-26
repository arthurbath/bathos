## 1. Reminder Input Behavior

- [x] 1.1 Replace the bulk native time input with the Start-picker text-field presentation
- [x] 1.2 Normalize bulk shorthand on first Return and apply the confirmed canonical time on second Return
- [x] 1.3 Validate mixed Today and future selections using the authoritative planning time zone
- [x] 1.4 Keep pointer Apply capable of resolving and submitting a valid raw value in one action
- [x] 1.5 Keep the Start picker open after its first successful normalization and close on the confirming Return

## 2. Verification

- [x] 2.1 Add integrated tests for valid, invalid, mixed-selection, pointer, and two-Return bulk reminder behavior
- [x] 2.2 Update the Start-picker reminder test to prove its two-Return contract
- [x] 2.3 Run focused Tasks tests, Tasks type checking, lint, build, OpenSpec validation, and diff checks
- [x] 2.4 Verify the bulk reminder interaction in the running app and archive the completed change
