## ADDED Requirements

### Requirement: Compatible security patches are applied without forced upgrades
The dependency-maintenance process SHALL apply current compatible security patches without using forced audit remediation or unrelated major upgrades.

#### Scenario: Compatible fixes are available
- **WHEN** the current audit identifies advisories with fixes inside the owning packages' declared compatibility ranges
- **THEN** the lockfile selects patched versions and no `--force` or out-of-range override is used

#### Scenario: A fix requires an incompatible dependency line
- **WHEN** removing an advisory would require a direct or transitive version outside the owning package's declared compatibility range
- **THEN** the dependency remains unchanged until a separately verified compatibility upgrade is available

### Requirement: Remaining advisories retain reachability evidence
The dependency-maintenance process SHALL document every remaining advisory by dependency path, execution surface, applicability to BathOS, and available fix status.

#### Scenario: An advisory remains after compatible patches
- **WHEN** the post-change audit still reports an advisory
- **THEN** the evaluation records why it remains and whether its affected path is runtime, development-only, platform-specific, or unreachable in BathOS

### Requirement: Dependency refreshes preserve application and toolchain behavior
The dependency-maintenance process SHALL verify CSS compilation, representative shared UI rendering, MCP contracts, deployment configuration, Edge bundling when MCP dependencies change, clean installation, and the complete regression matrix.

#### Scenario: Patched packages are installed
- **WHEN** the direct and transitive dependency refresh is complete
- **THEN** focused CSS, UI, MCP, Edge-bundle, clean-install, dependency-graph, audit, and global regression checks pass without a new non-performance failure
