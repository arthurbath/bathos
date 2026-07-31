## ADDED Requirements

### Requirement: Minimal Lock Screen Task Rows
The iOS rectangular Lock Screen widget SHALL reserve its horizontal space for task summaries and SHALL show no row context beyond one leading checkbox symbol.

#### Scenario: Render any Lock Screen list
- **WHEN** the rectangular Lock Screen widget renders Today, Upcoming, Anytime, or Someday
- **THEN** every row contains only one leading checkbox symbol and one task Summary, without horizon markers, recurrence symbols, date chips, Area labels, actionability symbols, Primary Link icons, or other metadata

### Requirement: Portrait-Only iPhone Companion
The iOS companion SHALL keep its iPhone interface in upright portrait orientation.

#### Scenario: Rotate an iPhone
- **WHEN** the user rotates an iPhone running Tasks into either landscape orientation
- **THEN** the native Tasks interface remains in upright portrait

#### Scenario: Build the companion
- **WHEN** Xcode produces the iPhone application
- **THEN** the built application declares only `UIInterfaceOrientationPortrait` for iPhone
