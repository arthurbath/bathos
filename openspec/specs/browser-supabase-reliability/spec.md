# Browser Supabase Reliability

## Purpose

Define the aligned browser Supabase client, retry, mutation-replay, and authentication coordination contract.

## Requirements

### Requirement: Exact aligned browser clients
BathOS SHALL resolve its direct browser Supabase and Auth clients to one exact stable 2.x release, and clean installation SHALL preserve that alignment without floating direct ranges.

#### Scenario: Install the browser client graph
- **WHEN** dependencies are installed from the committed manifest and lockfile
- **THEN** direct `@supabase/supabase-js` and `@supabase/auth-js` resolve to the same exact approved version with no duplicate incompatible Auth client

### Requirement: Bounded idempotent transient recovery
BathOS SHALL use the Supabase browser client's bounded retry behavior for transient PostgREST GET and HEAD failures without adding a generic React Query or wrapper retry layer around the same request.

#### Scenario: Recover an idempotent transient read
- **WHEN** a browser PostgREST GET or HEAD request encounters a client-recognized network, 503, or 520 transient failure
- **THEN** the Supabase client may retry within its documented bound and BathOS does not multiply those attempts through a generic outer retry

#### Scenario: Exhaust transient read recovery
- **WHEN** the Supabase client's bounded transient-read attempts are exhausted
- **THEN** BathOS surfaces the final failure through existing error handling without beginning another generic automatic retry sequence

### Requirement: Generic mutation replay safety
BathOS MUST NOT generically replay POST, PATCH, PUT, DELETE, or RPC operations after an ambiguous transient response unless the operation has a separate explicit idempotency contract.

#### Scenario: Mutation transport response is ambiguous
- **WHEN** a generic Supabase mutation or RPC call returns or throws a transient transport failure
- **THEN** the generic wrapper stops after that operation and surfaces the failure without automatically replaying it

#### Scenario: Domain-specific idempotent recovery exists
- **WHEN** a workflow uses a stable mutation identity, revision guard, or other explicit duplicate-prevention contract
- **THEN** that workflow may retain its separately tested bounded retry behavior

### Requirement: Preserve authentication coordination
BathOS SHALL preserve persistent browser sessions, token refresh, session restoration, and sign-out behavior while continuing to use a process-local Auth lock only inside trusted native Tasks companions.

#### Scenario: Run inside a native companion
- **WHEN** the browser client initializes inside a recognized native Tasks companion
- **THEN** Supabase Auth uses `processLock` and retains the current session lifecycle

#### Scenario: Run in an ordinary browser
- **WHEN** the browser client initializes in Safari or another ordinary web context
- **THEN** BathOS does not override Supabase's ordinary browser lock and session coordination

### Requirement: Keep Edge clients isolated
The browser-client upgrade SHALL NOT alter or deploy any Supabase Edge Function dependency source during this phase.

#### Scenario: Build tooling regenerates MCP output
- **WHEN** local build tooling produces an Edge-source dependency change from the upgraded browser package graph
- **THEN** the change is inspected and deferred to the Edge dependency phase without deployment
