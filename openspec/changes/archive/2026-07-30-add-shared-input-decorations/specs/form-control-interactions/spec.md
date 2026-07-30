## ADDED Requirements

### Requirement: Shared single-line controls support optional leading decorations
BathOS shared single-line text inputs, Select triggers, and date-picker triggers SHALL support an optional noninteractive Lucide decoration inside the leading content area without changing the control's value, accessible name, focus, keyboard, pointer, validation, or reset behavior.

#### Scenario: Render a decorated control
- **WHEN** a consumer supplies a decoration to a supported shared single-line control
- **THEN** the control presents the decoration in the same muted visual family as its trailing caret or calendar affordance while preserving the consumer's programmatic label

#### Scenario: Prevent decoration and content collision
- **WHEN** a decorated control's value or placeholder exceeds the available content width
- **THEN** the decoration remains visible and stationary while the content truncates, clips, or scrolls only within the content space reserved beside the decoration and never renders underneath it

#### Scenario: Preserve an undecorated control
- **WHEN** a consumer does not supply a decoration
- **THEN** the shared control preserves its existing structure, spacing, and behavior

#### Scenario: Keep decorations noninteractive
- **WHEN** a user points, tabs, or uses assistive technology within a decorated control
- **THEN** the decoration accepts no independent interaction, receives no focus, and does not replace the control's accessible name
