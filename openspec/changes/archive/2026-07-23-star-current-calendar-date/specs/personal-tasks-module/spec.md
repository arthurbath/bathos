## MODIFIED Requirements

### Requirement: Compact Task Date Controls
The Tasks expanded to-do editor SHALL present Start and Deadline as a matched responsive pair of date controls while retaining their independent autosave semantics.

#### Scenario: Present Start and Deadline together
- **WHEN** a to-do editor has enough horizontal space for two temporal controls
- **THEN** Start and Deadline appear on the same row with equal-width triggers and the same muted right-aligned calendar symbol

#### Scenario: Adapt the date controls to narrow width
- **WHEN** the editor cannot preserve usable trigger widths in two columns
- **THEN** Start and Deadline stack without horizontal overflow or clipped labels

#### Scenario: Clear Deadline inside its picker
- **WHEN** a to-do has a Deadline and the user activates Clear inside the Deadline picker
- **THEN** Tasks immediately persists a null Deadline, closes the picker, restores trigger focus, and exposes no separate inline clear button

#### Scenario: Leave the Deadline calendar through its lower boundary
- **WHEN** keyboard focus is on the final visible row of the Deadline calendar and the user presses ArrowDown
- **THEN** focus moves to Clear and the visible calendar month does not change

#### Scenario: Identify today in either calendar
- **WHEN** the owner planning date is visible in the Start or Deadline day calendar or its month picker
- **THEN** the shared Calendar replaces today’s in-month numeric day label with Lucide’s Star icon, places the same icon to the right of the current month name, preserves accessible current-date and month names, and retains selected-value highlighting independently
