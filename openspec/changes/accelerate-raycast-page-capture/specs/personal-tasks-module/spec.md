## ADDED Requirements

### Requirement: Direct Raycast Webpage Capture
BathOS SHALL expose a narrow authenticated database function for first-party Raycast webpage capture that accepts only a client idempotency UUID, generated task title, and HTTP or HTTPS webpage URL, and SHALL create the task through the established owner-scoped transactional task-creation boundary.

#### Scenario: Capture a webpage without MCP
- **WHEN** an authenticated Raycast client submits a valid new webpage capture through the Data API
- **THEN** BathOS creates one owned task and one creation event without invoking the general MCP Edge Function

#### Scenario: Apply fixed webpage placement and provenance
- **WHEN** the direct Raycast function accepts a webpage capture
- **THEN** the task is actionable in Anytime with the Today Inbox horizon, has empty Notes, uses browser-capture provenance, and stores the normalized URL as both webpage source URL and Primary Link

#### Scenario: Retry an accepted capture
- **WHEN** Raycast replays the same idempotency UUID, normalized title, and URL after an ambiguous response
- **THEN** BathOS returns the existing task with `already_applied` and retains one task and one creation event

#### Scenario: Reject anonymous or invalid capture
- **WHEN** an anonymous caller invokes the function or an authenticated caller submits an invalid URL or changed reuse of an accepted UUID
- **THEN** BathOS rejects the request without retaining a partial task or exposing another owner's data
