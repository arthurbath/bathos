## 1. Shared date control

- [x] 1.1 Remove the duplicate decorated date-field spacing and add a focused component regression test

## 2. Tasks list feedback

- [x] 2.1 Add the reversible three-second closed-task completion grace period and lifecycle tests
- [x] 2.2 Correct yesterday-to-today Control+D deadline advancement without regressing arrow navigation
- [x] 2.3 Suppress false empty states during cacheless watched-query fetching while retaining cached rows
- [x] 2.4 Keep legacy persisted source provenance and partially upgraded recurrence revisions from crashing task-list rendering
- [x] 2.5 Remove the erroneous current-date minimum from every Tasks deadline picker and cover past-date availability on row and editor surfaces
- [x] 2.6 Conceal cached task rows behind the centered loading indicator until an online launch establishes current-session freshness, while preserving offline and bounded-failure fallback

## 3. Native category contract

- [x] 3.1 Verify and document Productivity categorization through supported macOS and App Store Connect metadata

## 4. Validation and delivery

- [x] 4.1 Run focused tests, full Tasks tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 4.2 Verify rendered behavior in the local app
- [x] 4.3 Commit and push the completed change, then rebuild, sign, and install the macOS companion
- [x] 4.4 Run focused startup-freshness tests, Tasks TypeScript validation, build, strict OpenSpec validation, and rendered web verification
