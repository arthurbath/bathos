## ADDED Requirements

### Requirement: Persistent ordinary outlines remain subordinate to focus
Shared form controls SHALL use their persistent solid outline only as a resting boundary and SHALL retain the standard brighter keyboard-focus ring or border without changing the control's dimensions.

#### Scenario: Move focus between ordinary controls
- **WHEN** a user tabs from one ordinary control to another
- **THEN** the brighter focus indicator moves to the newly focused control while both controls retain the same muted resting outline geometry
