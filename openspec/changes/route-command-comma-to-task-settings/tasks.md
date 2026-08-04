## 1. Native Command Routing

- [x] 1.1 Add a conventional macOS Settings menu command bound to Command+, and route it to the existing Settings destination.
- [x] 1.2 Extend the native key resolver so the exact Command+, chord opens Settings before WebKit can consume it.

## 2. Regression Coverage and Validation

- [x] 2.1 Add native unit tests for accepted and rejected Command+, combinations while preserving Command+number routing.
- [x] 2.2 Run the macOS companion test suite, OpenSpec validation, and diff checks.
