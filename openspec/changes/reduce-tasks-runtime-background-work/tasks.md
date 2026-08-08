## 1. Runtime scheduling

- [x] 1.1 Gate planning activation by the current planning date and deduplicate in-flight work
- [x] 1.2 Recheck planning activation when the native app becomes active
- [x] 1.3 Adapt upload-queue polling between active and idle intervals
- [x] 1.4 Deduplicate queue-depth reads while preserving status-driven refreshes

## 2. Validation

- [x] 2.1 Cover planning-date and queue-poll scheduling policy with focused tests
- [x] 2.2 Run the Tasks runtime tests, full web test suite, lint, build, and OpenSpec validation
