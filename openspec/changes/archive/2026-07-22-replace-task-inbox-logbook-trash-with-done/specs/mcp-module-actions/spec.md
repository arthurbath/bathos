## MODIFIED Requirements

### Requirement: Personal Tasks MCP Resource Actions
The BathOS MCP server SHALL let an authenticated user read and mutate their task hierarchy, templates, to-dos, checklists, planning values, Today membership, Done recovery state, and supported structured workflow fields under the current Tasks domain rules.

#### Scenario: Read task data
- **WHEN** an authenticated MCP client requests task data or a defined task view
- **THEN** the server returns only task records owned by the signed-in user

#### Scenario: Read normalized task hierarchy
- **WHEN** an authenticated MCP client requests the bounded hierarchy or scopes it to one area, project, heading, or to-do
- **THEN** the server returns current owner-scoped records with stable relationship identifiers and explicit truncation metadata

#### Scenario: Read a defined planning view
- **WHEN** an authenticated MCP client requests Today, Upcoming, Anytime, Someday, or Done
- **THEN** the server applies lifecycle, disposition, Today-membership, planning-date, time-zone, and ordering rules and returns separately typed project, to-do, or Done-root results

#### Scenario: Reject a retired view
- **WHEN** an MCP client requests Inbox, Logbook, or Trash
- **THEN** schema validation rejects the retired value and identifies the current Today or Done vocabulary

#### Scenario: Create a to-do through the narrow contract
- **WHEN** an authenticated MCP client calls `create_task` with a new idempotency key, valid title, optional planning and container input, optional typed source, and optional supported integration channel
- **THEN** the server creates exactly one open present to-do with declared or MCP provenance, stable identifiers, append-only history, and a default placement of Anytime plus Today Later

#### Scenario: Create a Mail task atomically
- **WHEN** a verified integration calls `create_mail_task` with complete structured Mail identity, retirement destination, AI-processed content, optional accessible area, and a new idempotency key
- **THEN** the server atomically creates one Anytime to-do marked Today Later with `mail_automation` provenance and one retained Mail source, then returns the creation receipt and owner-safe records

#### Scenario: Deduplicate capture
- **WHEN** a client retries an exact creation request or Mail source identity
- **THEN** the server returns the existing task and source without creating duplicates and rejects changed reuse of the idempotency key

#### Scenario: Create hierarchy records
- **WHEN** a client calls a supported area, project, heading, or checklist creation tool
- **THEN** the server creates one owner-scoped present record with validated parents, deterministic append ordering, and append-only history

#### Scenario: Move Today membership explicitly
- **WHEN** a client moves an available Anytime to-do to Now, Next, Later, or no Today section
- **THEN** the server keeps destination Anytime, changes only supported Today membership and relevant ordering, and returns a revision-checked receipt

#### Scenario: Move between Anytime and Someday
- **WHEN** a client moves a to-do or project between Anytime and Someday
- **THEN** the server validates placement, clears incompatible dates or Today membership, generates the destination order, and does not accept Inbox or a separate Today destination

#### Scenario: Schedule future work
- **WHEN** a client assigns a future start date
- **THEN** the server places the work in Anytime, clears Today membership, includes it in Upcoming, and preserves valid container and deadline state

#### Scenario: Use explicit lifecycle and recovery tools
- **WHEN** a client completes, cancels, reopens, deletes, or restores supported work
- **THEN** the server applies the revision-checked task or hierarchy operation, projects terminal work into Done, and never exposes physical purge as a general MCP mutation

#### Scenario: Retry an accepted mutation
- **WHEN** a client retries an exact accepted mutation identifier after current state changes
- **THEN** the server returns the immutable original receipt and current owner-safe state without another write

#### Scenario: Detect stale or changed mutations
- **WHEN** expected revision is stale or a mutation identifier is reused with changed normalized input
- **THEN** the server returns a safe conflict or rejects changed reuse without modifying task data

#### Scenario: Preserve independent ordering
- **WHEN** a client reorders work structurally, in Anytime, or in one Today section
- **THEN** the server changes only the relevant hierarchy or planning order and never changes Today membership as a side effect

#### Scenario: Keep purge server-authoritative
- **WHEN** Done work reaches its automatic expiry boundary
- **THEN** no MCP tool can defer the purge, resurrect purged content, or enumerate another owner's terminal records
