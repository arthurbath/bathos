# platform-navigation Specification

## Purpose
TBD - created by archiving change rename-config-pages-to-settings. Update Purpose after archive.
## Requirements
### Requirement: Settings Page Naming
BathOS SHALL call module configuration pages Settings in every user-visible surface while preserving existing navigation contracts.

#### Scenario: Show a Settings destination
- **WHEN** navigation, a page title, a shortcut reference, an empty state, or a link refers to a module's configuration page
- **THEN** the visible and accessible name is Settings and its concept icon is Lucide `settings`

#### Scenario: Preserve existing routes
- **WHEN** a user follows an existing `/config` link or invokes an existing Settings keyboard shortcut
- **THEN** BathOS opens the renamed Settings page without changing the route or shortcut
