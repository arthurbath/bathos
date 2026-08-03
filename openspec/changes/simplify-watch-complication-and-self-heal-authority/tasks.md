## 1. Complication

- [x] 1.1 Replace the system accessory gauge with a single-track clockwise circular progress view and centered checkmark.
- [x] 1.2 Add focused tests or build-time verification for zero, partial, and complete ring fractions.

## 2. Watch Authority Recovery

- [x] 2.1 Add versioned authority-request and response payload helpers that never include task content.
- [x] 2.2 Make the iPhone coordinator answer immediate and queued background authority requests from its existing credential store.
- [x] 2.3 Make the watch request missing authority, hold one pending summary in memory, and submit directly over HTTPS when authority arrives.
- [x] 2.4 Cover valid, missing, expired, and recovered credential behavior with tests where practical.

## 3. Icon And Verification

- [x] 3.1 Verify the watch target uses the shared Icon Composer source and its watchOS circular rendition.
- [x] 3.2 Run OpenSpec validation and targeted iOS/watchOS builds or tests without signing.

## 4. Progress Repair And Capture Polish

- [x] 4.1 Replace the Watch progress aggregate so reached-start normalization still counts current Today tasks and same-day completions while excluding canceled and deleted tasks.
- [x] 4.2 Add database coverage for normalized Today starts, stale completions, and canceled tasks.
- [x] 4.3 Render a high-contrast progress stroke with a bolder center checkmark.
- [x] 4.4 Replace the expanding capture control with a centered circular plus and non-displacing two-second success feedback.
- [x] 4.5 Validate the updated OpenSpec, database test, native tests, and signed device builds.
- [x] 4.6 Advance the native build identity, rebuild the signed companion, verify the embedded Watch bundle versions, and reinstall the containing iPhone app plus the Watch app when the developer tunnel permits.
