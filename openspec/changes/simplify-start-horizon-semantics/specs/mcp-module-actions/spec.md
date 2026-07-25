## ADDED Requirements

### Requirement: MCP Start And Today Horizon Exclusivity
The Tasks MCP boundary SHALL expose and accept only canonical mutually exclusive future Start and Today horizon planning forms.

#### Scenario: Assign future Start through MCP
- **WHEN** an authenticated client assigns a legal future Start to a to-do or project
- **THEN** the server stores Start with a null Today horizon and returns that canonical planning state

#### Scenario: Assign a Today horizon through MCP
- **WHEN** an authenticated client assigns Inbox, Now, Next, or Later
- **THEN** the server clears future Start, stores the horizon, and returns the canonical Today planning state

#### Scenario: Reject a conflicting planning payload
- **WHEN** a client attempts to persist both a future Start and a Today horizon
- **THEN** the server normalizes the explicit future Start by clearing the horizon or rejects the ambiguous payload without retaining both values

#### Scenario: Generate and restore canonical work
- **WHEN** MCP generation, templates, recurrence, export, restore, or undo and redo materialize a task or project
- **THEN** the resulting record has at most one of future Start or Today horizon and preserves all independent content and organization fields

#### Scenario: Capture processed Mail in Today Inbox
- **WHEN** the verified Mail integration atomically creates a task from one successfully processed message
- **THEN** the server creates one active Anytime task with no future Start and the Inbox horizon while preserving the integration's idempotent source record and final AI-processed content
