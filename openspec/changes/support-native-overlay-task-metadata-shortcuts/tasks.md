## 1. Shortcut Policy

- [x] 1.1 Define and test the exact Tasks metadata-command allowlist for native quick entry.
- [x] 1.2 Suppress excluded Tasks Control commands in the quick-entry branch of the shared web keyboard handler.

## 2. macOS Event Bridge

- [x] 2.1 Add and test a macOS quick-entry Control-key policy that forwards supported metadata keys, consumes excluded Tasks keys, and passes through unowned keys.
- [x] 2.2 Forward accepted keys exactly once from the quick-entry panel to its hosted Tasks editor before AppKit text handling.

## 3. Verification

- [x] 3.1 Add integration coverage proving a metadata shortcut affects the new-task draft while excluded commands do not perform their ordinary list actions.
- [x] 3.2 Run focused web and macOS tests, lint/build checks, and OpenSpec validation.
