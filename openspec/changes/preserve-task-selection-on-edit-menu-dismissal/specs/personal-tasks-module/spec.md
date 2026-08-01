## ADDED Requirements

### Requirement: Selection-Owned Edit Menu Dismissal
Tasks SHALL treat dismissal of the selection-mode Edit menu as a menu interaction rather than an instruction to exit selection mode.

#### Scenario: Dismiss Edit menu with an outside pointer
- **WHEN** one or more tasks are selected, the selection-mode Edit menu is open, and the user clicks or taps outside the menu without choosing an action
- **THEN** Tasks closes the Edit menu, keeps selection mode active, preserves the selected task membership and range anchor, and does not activate the underlying interface target

#### Scenario: Preserve ordinary outside selection dismissal afterward
- **WHEN** the selection-mode Edit menu is closed and the user performs a later pointer interaction outside every task row and selection-owned surface
- **THEN** Tasks applies its ordinary outside-selection dismissal behavior
