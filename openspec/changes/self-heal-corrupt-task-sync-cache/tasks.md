## 1. Safe Database Generation

- [x] 1.1 Add installation-local generation persistence and deterministic versioned PowerSync filenames while preserving generation 1 for existing healthy clients.
- [x] 1.2 Add narrow SQLite corruption classification and a one-attempt recovery controller.
- [x] 1.3 Require a readable zero-depth upload queue before advancing the database generation, preserving the current namespace otherwise.

## 2. Runtime Recovery

- [x] 2.1 Observe PowerSync download status for confirmed corruption and transition the Tasks runtime into loading while a safe replacement is created.
- [x] 2.2 Keep the replacement behind the current-session freshness gate until authoritative synchronization completes.
- [x] 2.3 Add content-free recovery diagnostics and retain the visible terminal fallback when recovery is unsafe or fails.

## 3. Verification

- [x] 3.1 Add focused tests for corruption signatures, queue safety, generation monotonicity, bounded recovery, and stale-generation protection.
- [x] 3.2 Extend cross-client coverage for horizon changes and externally inserted tasks converging without reload.
- [x] 3.3 Run targeted tests, the full test suite, lint, build, and OpenSpec validation.
- [x] 3.4 Verify the recovered macOS client holds the latest production revisions with an empty upload queue and current successful sync timestamp.
