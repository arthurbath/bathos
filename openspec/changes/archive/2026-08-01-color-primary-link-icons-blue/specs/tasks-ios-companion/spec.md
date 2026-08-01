## MODIFIED Requirements

### Requirement: Native widgets preserve Primary Link identity
The Tasks iOS and macOS widgets SHALL use the closest native equivalent of the web task-row Primary Link identity icon and color every actionable Primary Link icon with native system blue without changing link routing or exposing the Primary Link value in the cached projection.

#### Scenario: Show a generic Primary Link
- **WHEN** a widget task has a generic Primary Link action
- **THEN** the widget uses the native chain-link symbol rather than the external-launch symbol and renders it in native system blue

#### Scenario: Show a recognized Primary Link
- **WHEN** a widget task has a recognized Mail, Jira, or Obsidian Primary Link kind
- **THEN** the widget preserves that kind's existing protocol-specific native symbol and renders it in native system blue

#### Scenario: Activate a widget Primary Link
- **WHEN** the user activates any widget Primary Link icon
- **THEN** the existing widget action opens the configured destination without launching an unrelated Tasks route
