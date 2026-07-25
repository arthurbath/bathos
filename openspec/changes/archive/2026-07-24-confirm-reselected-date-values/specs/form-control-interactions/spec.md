## MODIFIED Requirements

### Requirement: Date pickers are arrow-navigable and Tab-exiting
Shared date pickers SHALL use Space, Return, pointer input, and arrow navigation internally. Space, Return, and pointer activation SHALL be equivalent when they activate a final selection, including when the activated legal date is already the committed value, and internal controls SHALL NOT become a multi-stop segment of the containing form's Tab order.

#### Scenario: Open a date picker
- **WHEN** a focused date-picker trigger receives Space, Return, or pointer activation
- **THEN** the picker opens with focus on the selected legal date, otherwise today when legal, otherwise the first legal date

#### Scenario: Navigate a date picker
- **WHEN** a user presses arrow keys inside an open date picker outside a text-entry subcontrol
- **THEN** focus moves among enabled calendar, caption, paging, month, year, and picker-specific controls without changing the committed date merely because focus moved

#### Scenario: Confirm a final date-picker selection
- **WHEN** a user activates a focused legal date, Clear action, or other final-selection action with Space, Return, or pointer input
- **THEN** the picker commits that selection exactly once, closes after the owner accepts it, and restores focus to the trigger

#### Scenario: Confirm the already-selected date
- **WHEN** a user activates the already-selected legal date with Space, Return, or pointer input
- **THEN** the picker accepts that date as the user's final selection, preserves the committed value, closes, and restores focus to the trigger

#### Scenario: Keep date-picker navigation open
- **WHEN** a user activates a calendar pager, caption, month, year, or another navigation-only action with Space, Return, or pointer input
- **THEN** the picker performs the internal navigation action without committing a final value and remains open

#### Scenario: Leave a date picker with Tab
- **WHEN** a user presses Tab or Shift+Tab anywhere inside an open date picker
- **THEN** the picker closes without converting a merely focused date into a selection and focus moves to the next or previous control in the containing form

#### Scenario: Cancel a date picker
- **WHEN** a user presses unmodified Escape inside an open date picker
- **THEN** the picker closes with its pre-open committed value and returns focus to its trigger without canceling the owning form

#### Scenario: Clear an optional date
- **WHEN** a focused closed date field has an explicitly allowed null reset and the user presses Delete or Backspace
- **THEN** BathOS clears the date exactly once and retains focus
