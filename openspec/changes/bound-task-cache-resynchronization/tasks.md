## 1. Persistent Recovery Circuit Breaker

- [x] 1.1 Add a versioned installation-local recovery ledger with release and seven-day eligibility checks.
- [x] 1.2 Integrate the ledger into corrupt-cache replacement before database-generation advancement and expose a circuit-open outcome.
- [x] 1.3 Extend recovery diagnostics and runtime error handling without including task or owner content.
- [x] 1.4 Add focused tests for persistence across restarts, same-release blocking, cross-release cooldown, invalid ledger state, and replacement failure.

## 2. Cache-Preserving Native Installation

- [x] 2.1 Add a guarded macOS installer that verifies signed artifacts, fingerprints the stopped app's PowerSync cache, upgrades only the app bundle, and verifies cache continuity.
- [x] 2.2 Add a guarded iOS installer that verifies the artifact, records the installed data-container identity, performs an in-place install without uninstall, and verifies continuity.
- [x] 2.3 Add fixture-driven tests for both installers, including cacheless/new-install and fail-closed cases.
- [x] 2.4 Update the macOS and iOS companion deployment documentation to require the guarded installers.

## 3. Verification

- [x] 3.1 Run focused runtime and installer tests.
- [x] 3.2 Run the full test suite, lint, build, and OpenSpec validation.
