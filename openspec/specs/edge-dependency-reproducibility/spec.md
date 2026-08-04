# Edge Dependency Reproducibility

## Purpose

Define exact, function-isolated, reproducible dependency ownership for deployable BathOS Edge Functions.

## Requirements

### Requirement: Exact external Edge dependencies
BathOS SHALL identify every external Edge Function dependency by an exact approved version and MUST NOT use floating ranges, distribution tags, or unversioned CDN imports in deployable Edge source or function-local dependency maps.

#### Scenario: Inspect an Edge dependency graph
- **WHEN** a deployable Edge entrypoint or its function-local dependency map is validated
- **THEN** every external dependency resolves from an exact npm version that is visible in repository source

#### Scenario: A floating dependency is introduced
- **WHEN** an Edge import uses a major-only version, semver range, distribution tag, unversioned specifier, or CDN-hosted package URL
- **THEN** the repository dependency-pin contract fails before deployment

### Requirement: One approved Edge Supabase client
Every BathOS Edge Function that uses Supabase JS SHALL resolve the single exact approved 2.x version shared by the current dependency-hardening phase.

#### Scenario: Bundle any Supabase-backed function
- **WHEN** an Edge Function imports or maps `@supabase/supabase-js`
- **THEN** it resolves exact version 2.112.0 without a second direct Supabase JS version

### Requirement: Function-isolated reproducibility
Hand-maintained Edge Functions SHALL own their dependency configuration within the function boundary, and applicable lockfiles SHALL preserve reviewed resolution and integrity data.

#### Scenario: Update one function dependency
- **WHEN** a hand-maintained function changes an external dependency
- **THEN** its function-local configuration and applicable lock evidence change without silently altering another function's direct dependency contract

### Requirement: Generated MCP determinism
The generated MCP Edge source SHALL reproduce exact approved dependency specifiers from exact root generator inputs.

#### Scenario: Regenerate MCP source
- **WHEN** the MCP generator runs twice from the committed manifest and lockfile
- **THEN** the second run introduces no dependency-specifier diff and all generated external imports remain exact

### Requirement: Local runtime proof before deployment
An Edge dependency change SHALL pass local dependency resolution, bundle, and HTTP startup checks before it is eligible for deployment.

#### Scenario: Complete the Edge pinning phase
- **WHEN** the exact dependency graph and locks are updated
- **THEN** focused contracts, MCP checks, task-reminder bundling, and all-function local startup pass without deploying or mutating production
