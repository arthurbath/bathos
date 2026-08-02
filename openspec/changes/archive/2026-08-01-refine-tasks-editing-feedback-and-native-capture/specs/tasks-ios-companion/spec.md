## ADDED Requirements

### Requirement: Tasks supports iPhone landscape orientation
The installed iOS Tasks companion SHALL support the standard portrait and landscape interface orientations and SHALL preserve safe-area-aware web content in each orientation.

#### Scenario: Rotate an iPhone to landscape
- **WHEN** the user rotates the installed Tasks companion from portrait to either supported landscape orientation
- **THEN** the native shell rotates with the device and the Tasks web surface remains usable within the resulting safe areas

#### Scenario: Edit with the landscape software keyboard
- **WHEN** an editable Tasks control summons the software keyboard in landscape
- **THEN** the web surface remains scrollable and persistent mobile navigation is hidden until the keyboard is dismissed
