## MODIFIED Requirements

### Requirement: Production Task Synchronization
The system SHALL deploy remote task synchronization only through an explicitly approved topology whose download boundary mirrors task RLS and whose secrets remain outside the public client repository.

#### Scenario: Backfill a newly synchronized field into existing clients
- **WHEN** a deployed schema adds and populates a field on rows that existing PowerSync clients already cached
- **THEN** the rollout re-emits those rows after the matching client schema is available, preserves every stored business value, and allows existing clients to hydrate the field without clearing local data
