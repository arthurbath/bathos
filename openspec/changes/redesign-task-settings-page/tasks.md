## 1. Settings Composition

- [x] 1.1 Replace icon-prefixed Tasks settings sections with shared headed Cards in the required order
- [x] 1.2 Consolidate Notifications, automatic sorting, and native macOS Global Quick Entry into aligned feature rows
- [x] 1.3 Remove Backup and Restore and synchronization-details entry points from the Config frontend

## 2. Capability Controls

- [x] 2.1 Adapt browser notification states to an Enable action, enabled toggle, and bounded unavailable messages
- [x] 2.2 Add a lightweight Sync Status summary with the preferred timestamp format
- [x] 2.3 Make the native macOS shortcut control compact, clearable, and able to commit the same shortcut again

## 3. Verification

- [x] 3.1 Add focused tests for card order, removed surfaces, feature layout, notification states, and sync formatting
- [x] 3.2 Add focused tests for native shortcut visibility, clearing, and same-value commit completion
- [x] 3.3 Run Tasks typechecking, focused tests, lint, build, full tests, OpenSpec validation, and diff checks
- [x] 3.4 Verify the redesigned Settings page at desktop and mobile widths in the rendered app

## 4. Keyboard Command Access

- [x] 4.1 Add a final point-and-click-only Keyboard Shortcuts feature row whose Show action opens the existing command dialog
- [x] 4.2 Add focused tests for pointer visibility, touch-device suppression, and dialog opening
- [x] 4.3 Run focused tests, typechecking, lint, build, OpenSpec validation, diff checks, and rendered Settings QA

## 5. Platform-Specific Keyboard Reference

- [x] 5.1 Use symbolic shortcut notation in the Settings feature description and retitle the dialog Keyboard Shortcuts
- [x] 5.2 Render only the active platform shortcut column without redundant table headers and correct Tasks-specific heading casing
- [x] 5.3 Update focused tests and rendered QA for Mac and Windows shortcut presentation
