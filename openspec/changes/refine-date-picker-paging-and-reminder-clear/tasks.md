## 1. Shared Calendar Paging

- [x] 1.1 Add exact Shift+Left and Shift+Right page handling to day values and month pager controls while preserving legal-date bounds and focus.
- [x] 1.2 Add the equivalent bounded year paging to month values and year pager controls.
- [x] 1.3 Exclude modified chords from ordinary calendar arrow navigation so text-entry controls retain native Shift+Arrow behavior.

## 2. Reminder Clear Control

- [x] 2.1 Add the populated Reminder input's inline X before Alarm with collision-free input-group layout.
- [x] 2.2 Implement optimistic clear, persistence, failure restoration, and keyboard traversal among Reminder, Clear, and Alarm.

## 3. Verification

- [x] 3.1 Add shared calendar regression tests for scoped paging, bounds, focus, and modifier isolation.
- [x] 3.2 Add Tasks regression tests for clear visibility, activation, persistence, and native Reminder text selection.
- [x] 3.3 Run focused tests, lint/build checks appropriate to the touched surfaces, and OpenSpec validation.
