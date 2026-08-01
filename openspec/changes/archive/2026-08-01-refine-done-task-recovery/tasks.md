## 1. Done presentation

- [x] 1.1 Filter deleted checklist-item roots out of Done rendering and empty-state calculations without changing recoverable history.
- [x] 1.2 Add the canonical deleted-task `SquareX` icon and use it in neutral gray for trashed Done rows.
- [x] 1.3 Standardize task-level recovery controls, accessibility labels, menus, and errors on `Reopen`.

## 2. Verification

- [x] 2.1 Add focused tests for hidden checklist history, completed and trashed icons/colors, and recovery labels.
- [x] 2.2 Run focused and full automated validation, strict OpenSpec validation, and rendered Done-list browser QA without mutating user data.

## 3. Bulk Done recovery

- [x] 3.1 Replace Delete with Reopen in the Done selection-mode Edit menu while keeping terminal Area and Actionability submenus operable.
- [x] 3.2 Apply state-aware bulk recovery to mixed completed, canceled, and deleted selections under one operation identity.
- [x] 3.3 Add focused menu, transition, and terminal bulk-patch coverage and repeat rendered Done-list QA without mutating user data.
