## ADDED Requirements

### Requirement: Supported Node runtime policy
BathOS SHALL declare a Node.js runtime floor supported by its direct Supabase client and SHALL provide a local project pin for the current active LTS Node release.

#### Scenario: Install the root dependency graph
- **WHEN** a developer or automated environment installs BathOS dependencies
- **THEN** the manifest requires Node.js 22 or newer and the local runtime pin selects Node.js 24 LTS

#### Scenario: Use an unsupported Node release
- **WHEN** dependency installation runs under a Node release below the declared floor
- **THEN** the package manager reports that the environment is unsupported before the repository is treated as validated
