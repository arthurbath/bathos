## MODIFIED Requirements

### Requirement: Keep Edge clients isolated
Browser and Edge Supabase clients SHALL retain independent exact dependency evidence, and a coordinated source maintenance phase MUST NOT implicitly deploy any Edge Function or mutate any remote Supabase resource.

#### Scenario: Coordinate browser and Edge client maintenance
- **WHEN** an approved dependency phase updates browser and Edge Supabase clients to the same exact release
- **THEN** browser npm locks, function-local dependency maps, applicable Edge locks, and generated source each record that release independently
- **AND** no function is deployed and no remote database, secret, configuration, or production data is changed

#### Scenario: Build tooling regenerates MCP output
- **WHEN** local build tooling regenerates MCP Edge source from an updated exact browser dependency input
- **THEN** the generated source change is inspected, determinism is verified, and production deployment remains a separate explicitly authorized action
