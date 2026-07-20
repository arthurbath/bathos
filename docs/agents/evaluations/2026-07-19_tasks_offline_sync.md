# Personal Tasks Offline Persistence and Synchronization

**Date:** 2026-07-19
**Category:** Technology / Architecture
**Status:** PowerSync selected for the first production foundation

## Decision Context

The Personal Tasks module must accept creation, editing, completion, recovery, and manual reordering while offline. Those mutations must survive a browser or device restart, reconcile with Supabase after reconnection, and converge with mutations made through MCP or another client.

BathOS currently uses React, Vite, TanStack Query, the Supabase JavaScript client, Postgres RLS, and direct Supabase-backed MCP tools. Existing modules are online-first. Persisting a query cache would make old reads available, but it would not provide a durable mutation log, deterministic reconciliation, or conflict behavior.

The first product slice is small, but reliability is more important than minimizing foundation code. The selected approach should keep Supabase Auth, Postgres, RLS, and the MCP service authoritative without requiring the rest of BathOS to adopt a local-first architecture.

## Evaluation Criteria

- Durable local reads and writes in Safari, iOS web contexts, and other modern browsers
- Offline mutations that survive reloads and client restarts
- Automatic retry and reconnection without duplicate task creation
- A clear conflict model for task fields, completion, deletion, and manual order
- Visibility of server-side and MCP mutations on connected clients
- Compatibility with Supabase Auth, Postgres RLS, and owner-scoped data
- Module isolation from online-first BathOS modules
- Multi-tab behavior and reactive local queries
- Testability with local Supabase and synthetic accounts
- Sustainable operational cost, licensing, maintenance, and exit options
- A plausible path to a later native Apple client

## Options Considered

### Custom IndexedDB Store and Mutation Queue

A module-local IndexedDB database could store task projections and an append-only mutation queue. Supabase PostgREST and Realtime could provide upload and server-change transport.

**Advantages:**

- No additional synchronization service or commercial dependency
- Full control over mutation receipts, conflict rules, ordering, and data retention
- Smallest theoretical runtime surface for this module

**Disadvantages:**

- BathOS would own checkpointing, retries, deduplication, multi-tab leadership, schema migration, tombstones, reconciliation, and observability
- Supabase Realtime notifications are not by themselves a durable incremental replication protocol
- The hardest reliability work would be custom code maintained by one personal project

**Assessment:** Keep as the ultimate escape hatch, not the first implementation. It has the highest risk of subtle data-loss and convergence defects.

### Electric Sync With a Persistent Local Write Layer

Electric provides Postgres-to-client shape synchronization. Its current product explicitly handles the read path and does not prescribe or provide built-in write-path synchronization. Offline writes therefore require a separate persistent optimistic store, upload queue, and reconciliation design.

**Advantages:**

- Strong Postgres change streaming and selective shape model
- Composable with existing APIs
- Useful patterns for matching local writes with changes returning through the sync stream

**Disadvantages:**

- Leaves BathOS responsible for the durable write queue and much of the conflict model
- Adds a sync service without removing the highest-risk custom work
- Through-database patterns introduce more infrastructure than this initial personal module needs

**Assessment:** Do not spike first. Electric is attractive for read-heavy products, but its current write-path boundary is a poor match for a task system whose primary risk is dependable offline mutation.

### RxDB With Supabase Replication

RxDB now provides a dedicated Supabase replication plugin. It uses PostgREST for checkpointed pull and push operations, Supabase Realtime for change detection, and the RxDB sync engine for retries and conflict handling. The free storage choices include Dexie-backed browser persistence.

**Advantages:**

- No additional synchronization service between the client and Supabase
- Local-first reads, writes, reactive queries, retry, checkpoints, conflicts, and multi-tab leadership
- Supabase RLS remains directly involved in browser replication
- Open-source core and a free path suitable for a small dataset

**Disadvantages:**

- The dedicated Supabase plugin is new as of this evaluation
- Requires a second document schema and careful mapping to nullable Postgres rows
- Replication expects explicit modified and deleted fields and optimistic concurrency behavior
- Premium licensing may become relevant for preferred native SQLite, OPFS, encryption, worker, or performance plugins
- A future Swift client would not reuse the JavaScript database layer

**Assessment:** Strong fallback and comparison candidate. Its direct Supabase architecture is appealing, but the young integration should not become the foundation without an adversarial spike.

### PowerSync With Supabase

PowerSync maintains a local SQLite database in the browser, streams an owner-scoped subset of Postgres into it, and records local writes in a durable upload queue. Its Supabase connector uploads queued writes through the existing Supabase client when connectivity returns. PowerSync provides web, Swift, Kotlin, React Native, Flutter, and other client SDKs.

**Advantages:**

- Local SQLite is the application read and write surface, including while offline
- The upload queue, reconnection loop, live queries, multi-tab coordination, and schema projection are provided
- Official Supabase Auth and Postgres integration guidance exists
- Supabase RLS remains authoritative for uploaded writes
- Sync Streams can restrict downloaded data to the signed-in owner
- The web SDK documents an OPFS option intended for multi-tab Safari and iOS use
- Multiple native SDKs preserve a credible path to a later Apple client
- The client SDKs use the Apache 2.0 license

**Disadvantages:**

- Requires a PowerSync service, a Postgres replication role, a publication, and a second access-control configuration for downloads
- The replication role uses `BYPASSRLS`, so Sync Streams become a security-critical mirror of owner access rules
- PowerSync Cloud adds another processor of personal task data and its free instances deactivate after inactivity
- Production cloud service currently starts at a paid tier if uninterrupted availability is required
- Self-hosting adds operational work and the server uses a source-available license
- Upload handling still needs careful idempotency, RLS, error classification, and mutation receipts

**Assessment:** Best first spike. It addresses the complete offline write loop, documents the exact Supabase pairing BathOS needs, and offers the strongest native-client continuity. Its additional service and duplicated download authorization are serious costs that the spike must expose rather than assume away.

## Decision

Use PowerSync as the module-local persistence and synchronization foundation for the first production task slice. Browser clients will read and write local SQLite, PowerSync will persist the upload queue, and a task-domain connector will upload queued mutations through Supabase. Postgres, RLS, and integer task revisions remain authoritative.

The disposable local spike passed the security, Safari, persistence, reconciliation, ordering, and conflict tests defined below. RxDB remains the first fallback if production integration exposes a material failure that the spike did not reveal. Do not fall back directly to a custom mutation queue without documenting why both maintained engines failed.

PowerSync Cloud versus self-hosting remains a separate deployment decision. Cost, privacy, uptime, and maintenance must be resolved before a remotely available production module is deployed. That choice does not block the local domain foundation.

## Disposable Spike Scope

Use synthetic task data and an isolated schema or disposable local database. The spike needs only these fields:

- Stable UUID
- Owner UUID
- Title
- Inbox or Today destination
- Completion timestamp
- Recoverable deletion timestamp
- Manual order key
- Client mutation identifier
- Server revision or equivalent concurrency token
- Created and updated timestamps

The spike must demonstrate:

1. Create a task online and observe it in local SQLite and Postgres.
2. Go offline, create and complete tasks, hard-reload the client, and confirm the pending state survives.
3. Reconnect and confirm each mutation reaches Postgres exactly once from the user's perspective.
4. Restart the client and confirm local state reconstructs without stale-value snapback.
5. Apply a synthetic server or MCP mutation and confirm the connected client receives it.
6. Edit the same field offline on two clients and record the resulting conflict behavior.
7. Complete on one client while editing or deleting on another and verify the documented state rule.
8. Reorder the same Today list on two clients and determine whether the chosen ordering scheme converges.
9. Restore a recoverably deleted task before and after synchronization.
10. Verify a second synthetic owner cannot download or upload the first owner's rows.
11. Exercise two browser tabs and a real Safari session, including reload and reconnect.
12. Capture queue depth, last successful sync, upload failures, and actionable diagnostics without logging task content.

## Executed Spike Results

The spike ran against local Supabase, self-hosted PowerSync 1.23.3, PowerSync Web 1.39.0, Playwright WebKit 26.5, and real macOS Safari. It used isolated synthetic accounts and task titles. No production database, personal task content, or paid service was connected.

All required cases passed:

1. Online creation appeared in local SQLite and exactly one Postgres row.
2. A task created with both PowerSync and Supabase unavailable survived a full WebKit reload with one queued mutation.
3. Reconnection drained the queue and produced one logical server row by stable UUID.
4. Offline completion survived a reload and reconciled as the next task revision.
5. A server-originated row downloaded into both independent installations.
6. Two independent OPFS databases edited the same base revision. The first accepted revision remained authoritative, the stale queue drained, and the stale client recorded a content-free conflict receipt before converging.
7. Completion uploaded from one installation defeated a stale title edit from another through the same revision rule.
8. Two different tasks moved into the same fractional gap received the same `a0V` key and converged to the same `(order_key, id)` total order on both installations.
9. Recoverable deletion and restoration converged when queued together offline and when synchronized as separate revisions.
10. A second owner downloaded none of owner A's rows. A rollback-only authenticated-role probe returned zero cross-owner reads and updates and rejected an owner-spoofed insert. An owner-B task never appeared for owner A, and the same installation removed owner-B rows when it switched to owner A.
11. Two same-origin WebKit tabs shared one local database and one durable mutation queue. A task created while disconnected in one tab appeared immediately in the other and uploaded once after reconnection.
12. Real Safari synchronized the dataset, created a task while disconnected, exposed a queue depth of one, retained the task through reload, and reconnected with a zero queue.

## Selected Reconciliation Contract

- Every task has a stable UUID and monotonically increasing integer revision.
- A mutation may update the server only when the server still has the mutation's base revision.
- A stale mutation does not retry indefinitely or overwrite the accepted row. It produces a local conflict receipt containing identifiers, revisions, operation type, timestamp, and error code only, then accepts the authoritative server row on download.
- The first foundation treats the task record as the conflict unit. It does not automatically merge fields from concurrent revisions.
- Creation is logically idempotent through stable task UUIDs and a unique client mutation identifier.
- Manual order uses fractional keys and stable task ID as a tie-break. Equal keys are valid for different tasks.
- Concurrent changes to the same task, including reorders, use the revision conflict rule.

## Operational Findings

- The PowerSync download rule is a second authorization boundary because its replication connection bypasses RLS. Owner predicates in Sync Streams and Postgres RLS must be changed and tested together.
- Production clients must clear or rebind their local projection before rendering after an account change, even though the spike's same-installation switch removed the prior owner's rows successfully.
- The Supabase upload API and PowerSync stream can fail independently. A single connected boolean can therefore be misleading. Production diagnostics need queue depth, last successful sync, upload error, download error, and conflict state.
- Forced-outage browser diagnostics contained blocked local endpoint URLs but no task content.
- OPFS plus PowerSync's multi-tab worker behaved correctly in macOS Safari and Playwright WebKit. iOS storage behavior remains part of sustained validation rather than being inferred from the macOS result.
- The production service topology is not selected. Cloud and self-hosted operation require a separate privacy, cost, uptime, backup, upgrade, and observability decision.

## Failure Conditions

Stop and evaluate RxDB if the spike finds any of the following without a small, well-contained remedy:

- Offline writes disappear after reload or browser restart
- Retry can create duplicate logical tasks
- Safari or iOS storage is unstable for the intended use
- Owner-scoped Sync Streams cannot be made simple and auditable
- The production service would require disproportionate operational access or cost
- Conflict behavior cannot support explicit task state and ordering rules
- PowerSync schema constraints materially distort the task domain
- A future native client would require a second incompatible synchronization contract

## Sources

- [PowerSync Supabase integration](https://docs.powersync.com/integrations/supabase/guide)
- [PowerSync JavaScript Web SDK](https://docs.powersync.com/client-sdks/reference/javascript-web)
- [PowerSync RLS and Sync Streams](https://docs.powersync.com/integrations/supabase/rls-and-sync-streams)
- [PowerSync client-side backend integration](https://docs.powersync.com/configuration/app-backend/client-side-integration)
- [PowerSync self-hosting](https://docs.powersync.com/intro/self-hosting)
- [PowerSync pricing](https://powersync.com/pricing)
- [Electric writes guide](https://electric.ax/docs/sync/guides/writes)
- [RxDB Supabase replication](https://rxdb.info/replication-supabase.html)
- [RxDB replication engine](https://rxdb.info/replication.html)
- [RxDB storage options](https://rxdb.info/rx-storage.html)

## Changes Made

- Added and executed the isolated spike in `spikes/tasks-offline-sync-powersync`.
- Selected PowerSync for the first production foundation and retained RxDB as the fallback comparison.
- Recorded the revision, ordering, authorization, and diagnostics contracts in OpenSpec.
- Added a rollback-only RLS verification script.
- Changed only local disposable services and synthetic data. No production service or database was modified.
