## ADDED Requirements

### Requirement: Canonical Lucide macOS Widget Iconography
The shared macOS Tasks widget SHALL use the same canonical Lucide icon vocabulary as the Tasks application and iOS list widget for list identity, Today horizons, task state, recurrence, Primary Links, add actions, and empty states.

#### Scenario: Render the Mac list widget
- **WHEN** macOS renders any supported Tasks widget list and row state
- **THEN** every Tasks-domain icon position uses the corresponding canonical Lucide geometry, semantic color, and accessible meaning

#### Scenario: Change a canonical Tasks icon
- **WHEN** a canonical icon assignment changes in the Tasks application
- **THEN** a contract check identifies any stale macOS widget assignment before release
