## MODIFIED Requirements

### Requirement: Native Widget Freshness
The native companion SHALL refresh widget timelines after accepting a changed web projection, SHALL independently request a current bounded projection during system-budgeted WidgetKit timeline generation, and SHALL preserve the last valid projection when a background refresh cannot succeed.

#### Scenario: Accept a changed web projection
- **WHEN** the native host atomically stores a valid web projection whose content differs from the cache
- **THEN** it requests WidgetKit to reload the Tasks widget timeline

#### Scenario: Receive the same web projection
- **WHEN** the native host receives a projection identical to the current cache apart from generation time
- **THEN** it avoids an unnecessary widget reload

#### Scenario: Refresh on the system schedule
- **WHEN** WidgetKit asks the provider for a later timeline and a valid native widget credential is available
- **THEN** the provider requests the current owner-scoped bounded projection, validates and atomically caches a successful response, renders it, and returns a conservative future refresh policy

#### Scenario: Receive a remote task change
- **WHEN** an eligible task or durable Tasks list preference changes on another client before the containing iOS app opens
- **THEN** a later successful WidgetKit background refresh reflects that change without requiring the user to open Tasks

#### Scenario: Fail a background refresh
- **WHEN** the device is offline, the request times out, the server rejects the credential, the response is malformed or oversized, the response owner differs from the credential owner, or persistence fails
- **THEN** the provider leaves the last valid shared projection unchanged and renders that projection without claiming that the failed response is current

#### Scenario: Render cached content without an app-refresh prompt
- **WHEN** a valid shared projection exists, regardless of its generation time
- **THEN** the widget renders the projection without instructing the user to open Tasks to refresh it

#### Scenario: Render before authentication or first projection
- **WHEN** no valid owner-scoped cache or credential-backed response exists
- **THEN** the widget prompts the user to open BathOS Tasks and does not show sample or prior-owner task content

## ADDED Requirements

### Requirement: Native Widget Snapshot Authority
The system SHALL authorize a native installation to read only its owner’s bounded widget projection through an expiring, revocable, owner-and-installation-bound credential.

#### Scenario: Read a valid owner projection
- **WHEN** the widget submits a valid unexpired credential to the snapshot operation
- **THEN** the server returns one schema-versioned projection containing Today, Upcoming, Anytime, Someday, and Done in the owner’s current planning date, list order, quick filter, area order, and automatic-sort configuration

#### Scenario: Bound returned lists
- **WHEN** an eligible list contains more than the native cache limit
- **THEN** the response includes the filtered total count, only the bounded leading rows in authoritative order, and an accurate truncation indicator

#### Scenario: Withhold detailed task content
- **WHEN** the server builds a native widget projection
- **THEN** it omits notes, checklist text, reminder records, Mail source metadata, Supabase session material, PowerSync credentials, widget credentials, and every unrelated BathOS record

#### Scenario: Reject invalid native authority
- **WHEN** the snapshot request has a missing, malformed, expired, revoked, or unknown credential
- **THEN** the server returns a content-free rejection and exposes no owner or task data

#### Scenario: Prevent cross-owner reads
- **WHEN** one owner’s valid native credential requests a projection
- **THEN** the server returns only that credential owner’s projection and provides no parameter capable of selecting another owner

#### Scenario: Preserve the replication boundary
- **WHEN** snapshot-read authority is deployed
- **THEN** no credential record or new private function becomes part of PowerSync and the approved Tasks publication remains exactly 20 tables
