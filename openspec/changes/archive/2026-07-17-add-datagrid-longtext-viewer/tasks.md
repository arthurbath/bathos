## 1. Shared Longtext Cell

- [x] 1.1 Extend `GridEditableCell` with opt-in longtext input semantics and a keyboard-navigable magnifying-glass action.
- [x] 1.2 Add the read-only full-content modal with field title, whitespace preservation, wrapping, null placeholder, and current local value display.

## 2. Garage Integration

- [x] 2.1 Designate Garage Services Notes as longtext with the Notes viewer title.

## 3. Verification

- [x] 3.1 Add focused shared DataGrid tests for populated, empty, and keyboard-opened longtext viewers while preserving inline editing.
- [x] 3.2 Add or update a focused Garage Services test proving the Notes column renders the longtext action.
- [x] 3.3 Run focused tests, lint, build, and OpenSpec validation.

## 4. Garage Servicings Integration

- [x] 4.1 Designate Garage Servicings Notes as longtext with the Notes viewer title.
- [x] 4.2 Add focused coverage proving the Servicings Notes column uses longtext.
- [x] 4.3 Run the focused Servicings test, lint, build, and OpenSpec validation.

## 5. Footerless Viewer Layout

- [x] 5.1 Remove the reserved footer row from longtext viewer modals without changing shared form-dialog defaults.
- [x] 5.2 Add focused coverage for the two-row longtext modal layout.
- [x] 5.3 Run focused tests, lint, build, and OpenSpec validation.

## 6. Remove Viewer Chin

- [x] 6.1 Extend the longtext body through the dialog's bottom padding and remove its bottom divider.
- [x] 6.2 Add focused class coverage and verify the rendered chin height is zero.
- [x] 6.3 Run focused tests, lint, build, and OpenSpec validation.

## 7. Balance Viewer Body Padding

- [x] 7.1 Match the longtext content body's top padding to its 24px bottom padding.
- [x] 7.2 Add focused class coverage and verify the rendered top and bottom padding match.
- [x] 7.3 Run focused tests, lint, build, and OpenSpec validation.
