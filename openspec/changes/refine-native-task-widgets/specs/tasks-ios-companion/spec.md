## MODIFIED Requirements

### Requirement: Native Tasks list widget families

The iOS companion SHALL offer the Tasks list widget in medium, large, and extra-large system families where WidgetKit supports them, SHALL preserve the same list selection and task interactions in every family, and SHALL use a family-specific visible-task limit.

#### Scenario: Select a shorter widget
- **WHEN** the user adds the medium Tasks list widget
- **THEN** the widget shows the established header and interactions with no more than four task rows

#### Scenario: Select a taller widget
- **WHEN** the user adds the extra-large Tasks list widget on a supported surface
- **THEN** the widget shows the established header and interactions with no more than sixteen task rows

#### Scenario: Widget needs the app
- **WHEN** no authenticated widget snapshot is available
- **THEN** the body centers the task icon and the message `Open Tasks` between the header divider and the widget bottom
