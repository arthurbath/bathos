## 1. Task Command Routing

- [x] 1.1 Add platform-aware Link and Notes focus commands to the task keyboard-command registry and single-target dispatcher.
- [x] 1.2 Open or reveal the requested field and implement end-to-beginning caret toggling after editor mount.
- [x] 1.3 Refine the checklist command so invoking it from the focused empty ordinary insertion-slot draft moves and focuses that transient draft at the top.

## 2. Optional Content Drawer

- [x] 2.1 Make empty Notes, Link, and Checklist editor-local disclosures that reset when an empty drawer is closed.
- [x] 2.2 Render the ordered, centered `+ Notes`, `+ Link`, and `+ Checklist` action row at the drawer bottom with conditional separators.
- [x] 2.3 Move optional content into the specified bottom order, use `Link` in user-facing copy, and reduce bottom padding when Checklist is the final content and no add actions remain.
- [x] 2.4 Restyle the optional-content action row as evenly distributed shared primary-outline buttons and remove redundant separators.

## 3. Reference And Verification

- [x] 3.1 Update the platform-aware Keyboard Shortcuts dialog for the H, N, and refined C commands.
- [x] 3.2 Add focused unit and interaction coverage for shortcut routing, disclosure lifecycle, caret placement, checklist position toggling, and drawer layout.
- [x] 3.3 Run targeted tests, full Tasks-relevant validation, lint, build, and OpenSpec validation, then verify the rendered drawer and shortcuts in the local app.
