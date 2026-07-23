## 1. Shared Calendar Navigation

- [x] 1.1 Make header-to-grid ArrowDown navigation scan for enabled day and month destinations.
- [x] 1.2 Consume ArrowDown at the final reachable day row and expose an optional lower-boundary focus handoff.
- [x] 1.3 Add shared Calendar regression tests for disabled upper rows and the lower boundary.

## 2. Tasks Picker Composition

- [x] 2.1 Route ArrowDown from Today horizons through the active calendar header before dates or months.
- [x] 2.2 Close Start after Enter confirms a Today horizon or legal date while preserving pointer, Space, and internal calendar navigation behavior.
- [x] 2.3 Connect the Deadline calendar lower boundary to Clear without changing the visible month.
- [x] 2.4 Add DatePickerField and Tasks regressions for focus order, final Enter selections, and internal navigation.

## 3. Validation and Closeout

- [x] 3.1 Run focused tests, Tasks typecheck, lint, build, and OpenSpec validation.
- [x] 3.2 Verify the rendered keyboard flows in desktop and mobile Safari.
- [x] 3.3 Run the full deterministic test suite, sync the durable specification, and archive the OpenSpec change.
