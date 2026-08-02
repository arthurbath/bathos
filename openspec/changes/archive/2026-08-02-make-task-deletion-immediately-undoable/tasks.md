## 1. Regression Coverage

- [x] 1.1 Add a hook regression test proving an accepted deletion becomes the newest undo action.
- [x] 1.2 Add a projection-lag regression test proving immediate Undo remains bound to the exact deletion.

## 2. Client History Repair

- [x] 2.1 Repair deletion reservation and projected-cursor coordination without weakening snapshot guards.
- [x] 2.2 Verify deletion restores the task hierarchy and prior planning state through the shared undo path.

## 3. Validation

- [x] 3.1 Run targeted task undo tests and related Tasks shell regression tests.
- [x] 3.2 Run OpenSpec validation, lint or type checks, and the production build.
- [x] 3.3 Exercise the local Tasks UI and capture browser evidence without mutating personal production data.
