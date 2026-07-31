## 1. Recurrence Prototype Authority

- [x] 1.1 Add a forward-only owner-scoped prototype commit RPC and owner-safe lifecycle triggers for trash, restore, and permanent purge
- [x] 1.2 Prove that prototype snapshots alone supply Primary Link and checklist content/completion state to every new instance
- [x] 1.3 Prove that instance edits never update prototype content and that after-completion instances contribute only their Done date
- [x] 1.4 Add database coverage for prototype edit conflicts, trash suspension, restore, and 30-day lifecycle compatibility

## 2. Recurrence Prototype Web Experience

- [x] 2.1 Open recurrence prototypes in the ordinary metadata drawer while omitting Start and Deadline
- [x] 2.2 Add the prototype Edit Repeat action beneath metadata and the correct ellipsis actions
- [x] 2.3 Persist prototype metadata as a new template revision when the drawer commits
- [x] 2.4 Remove recurrence Ends controls and save unbounded recurrence rules
- [x] 2.5 Include prototypes in multi-select and derive the bulk Edit action intersection without Edit Repeat
- [x] 2.6 Preserve prototypes during cross-date group drops while allowing same-date group reordering
- [x] 2.7 Add focused React tests for editing, action menus, selection, drag, trash, restore, and Ends removal

## 3. Compact Shared Surfaces

- [x] 3.1 Brighten the shared floating mobile-navigation border without changing geometry
- [x] 3.2 Remove every Lock Screen mini-widget row flourish except its leading state symbol and Summary
- [x] 3.3 Add shared-widget and navigation regression tests

## 4. macOS Global Quick Entry

- [x] 4.1 Add a macOS-native-only Settings shortcut recorder and bridge contract
- [x] 4.2 Persist and register one global shortcut while retaining the last working registration on failure
- [x] 4.3 Add a centered all-Spaces native overlay with a shared persistent app-bound WebKit surface
- [x] 4.4 Add a compact web quick-entry route that reuses the ordinary new-task editor and command behavior
- [x] 4.5 Close the overlay after commit or cancellation and refresh the main app/native widget projection
- [x] 4.6 Add Swift and web tests for recording, registration, routing, commit, cancellation, and failure

## 5. Portrait Presentation

- [x] 5.1 Declare portrait-only iPhone orientation in the native target and verify the built Info.plist
- [x] 5.2 Declare `portrait-primary` in the Tasks PWA manifest and test the generated manifest

## 6. Validation

- [x] 6.1 Run focused database, React, and Swift tests for the changed surfaces
- [x] 6.2 Run the full database and application suites, TypeScript, lint, build, and strict OpenSpec validation
- [x] 6.3 Build the iOS and macOS companions without signing and verify orientation, widget, bridge, and overlay artifacts
- [x] 6.4 Inspect rendered browser behavior and prepare the overnight assumptions and ambiguity report
