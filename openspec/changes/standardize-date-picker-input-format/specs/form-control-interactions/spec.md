## ADDED Requirements

### Requirement: Date-picker inputs use the standard explicit-date format
Every BathOS date-picker input, including grid-specific picker triggers, SHALL display a selected explicit calendar date in the year-first `YYYY Mon D` format, using a three-letter English month name and an unpadded day number. This display requirement SHALL NOT change the stored calendar date, calendar navigation, legal selections, placeholders, DataGrid navigation, or an intentionally supplied semantic display value.

#### Scenario: Display an explicit selected date
- **WHEN** an ordinary date-picker input has the selected calendar date 2026-08-07
- **THEN** its closed trigger displays `2026 Aug 7`

#### Scenario: Preserve a semantic display value
- **WHEN** a date-picker input intentionally supplies a semantic display value such as Today or Tomorrow
- **THEN** the trigger displays that semantic value rather than replacing it with an explicit formatted date

#### Scenario: Use the shared picker contract in ordinary forms
- **WHEN** an ordinary non-grid form collects a calendar date
- **THEN** it uses the shared BathOS date-picker control so the visible selected value follows the standard format

#### Scenario: Display a date in a grid-specific picker
- **WHEN** a specialized DataGrid date-picker trigger has the selected calendar date 2026-08-07
- **THEN** it displays `2026 Aug 7` while preserving the shared DataGrid focus and editing behavior
