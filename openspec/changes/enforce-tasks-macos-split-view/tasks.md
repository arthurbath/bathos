## 1. Native Window Policy

- [x] 1.1 Explicitly allow full-screen tiling and remove opposed full-screen collection behaviors
- [x] 1.2 Reapply the idempotent window policy after relevant SwiftUI and AppKit lifecycle transitions

## 2. Regression Coverage

- [x] 2.1 Extend native tests for the narrow minimum, explicit tiling eligibility, opposed-state cleanup, and repeated application
- [x] 2.2 Update companion documentation with the durable two-up full-screen contract and supported entry behavior

## 3. Verification

- [x] 3.1 Run native unit tests and a signed macOS build
- [x] 3.2 Run strict OpenSpec validation
- [x] 3.3 Verify the installed Tasks app exposes and enters macOS Full Screen Tile without losing its responsive mobile-class layout
