## Context

`GridEditableCell` currently renders a single input that supports BathOS's shared focus, editing, keyboard navigation, delete-reset, history, and optimistic async-save behavior. Long values are editable but are hard to inspect within a compact column. Garage Services and Servicings Notes are the first requested fields that need a full-content reader.

## Goals / Non-Goals

**Goals:**

- Make full longtext values readable without changing the compact grid layout.
- Keep the behavior opt-in at the cell declaration.
- Preserve the existing text-cell editing and DataGrid navigation contracts.
- Provide an accessible icon action and modal reader.

**Non-Goals:**

- Replace inline editing with multiline editing.
- Infer longtext from column width, database type, or content length.
- Automatically migrate other Notes columns beyond Garage Services and Servicings.
- Change stored values or Garage service persistence.

## Decisions

- Extend `GridEditableCell` with the semantic input type `longtext`. Internally it remains a text input, so existing text editing and save behavior are reused rather than duplicated in a separate cell primitive.
- When `type="longtext"`, wrap the input and a compact outline icon button in the same flex layout used by other compound grid controls. The action receives a fractional navigation column so it participates in keyboard traversal without changing surrounding integer column indexes.
- Use the Lucide `Search` icon and a label derived from an optional longtext title. The Garage Notes cell supplies `Notes`, while the shared fallback is `Full Text`.
- Render the complete current cell value in the shared modal `Dialog`, using a title-only header and a scrollable, whitespace-preserving read-only body. Empty content is represented by the shared null placeholder.
- Override the shared three-row modal grid on longtext viewers with a two-row header-and-body grid, pull the body through the dialog's 24px bottom padding and 1px outer border, and remove the body's bottom divider so no footer chin remains.
- Override the longtext body's shared 8px top padding with 24px so its top and bottom content padding match.
- The viewer displays the cell's local value so a just-edited value remains visible while its async save is pending, consistent with the DataGrid optimistic-display policy.

## Risks / Trade-offs

- [Risk] Adding a second focusable control changes Tab/arrow traversal within designated cells. → Mitigation: follow the existing compound-cell navigation pattern and add focused keyboard tests.
- [Risk] Clicking the viewer while editing blurs and commits the input. → Mitigation: preserve the existing blur-save contract and display the local committed value in the reader.
- [Risk] Very large values could exceed the viewport. → Mitigation: use the shared modal's bounded height and scrollable body with wrapping.
- [Risk] A global modal layout change could affect form dialogs that use footers. → Mitigation: scope the two-row override to the longtext viewer only.
- [Risk] Removing outer bottom space could expose square body corners. → Mitigation: retain the shared dialog's rounded, overflow-hidden container so the body is clipped to the modal radius.
