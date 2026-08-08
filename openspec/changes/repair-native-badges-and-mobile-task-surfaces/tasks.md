## 1. Native Badge Authorization and Settings

- [x] 1.1 Add a versioned compatibility policy and tests for one-time badge authorization repair while respecting explicit disablement.
- [x] 1.2 Update the shared native notification coordinator to apply the repair and refresh authoritative notification settings.
- [x] 1.3 Cache resolved native notification settings and make enabled or denied Settings handoff immediate on iOS and macOS.

## 2. Task Surface Presentation

- [x] 2.1 Apply equal negative trailing alignment to persisted and draft checklist rows while preserving their current leading alignment.
- [x] 2.2 Restore inset border and rounded corners to centered mobile Start and Deadline pickers and remove surplus footer space.
- [x] 2.3 Raise the centered picker backdrop above mobile navigation and selection controls while keeping the picker above the backdrop.

## 3. Verification

- [x] 3.1 Run targeted native, component, and OpenSpec tests for badge compatibility and the repaired Task surfaces.
- [x] 3.2 Run lint, build, specification validation, and native build verification appropriate to the changed targets.
- [x] 3.3 Perform rendered mobile QA for the checklist and centered temporal picker, and document any device-only badge readback still requiring a rebuilt installation.
