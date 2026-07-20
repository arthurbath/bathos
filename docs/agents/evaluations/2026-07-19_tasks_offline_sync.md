# Personal Tasks Offline Persistence and Synchronization

**Date:** 2026-07-19
**Category:** Technology / Architecture
**Status:** Provisional recommendation pending executable spike

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

## Provisional Recommendation

Spike PowerSync first, using local self-hosted PowerSync with local Supabase where practical. Do not create production tables, connect the production Supabase project, or open a paid PowerSync account during the disposable spike.

Treat the choice as provisional until the spike proves all acceptance tests. If PowerSync fails the security, Safari, operational, or complexity tests, run the same fixture and scenarios against RxDB with its Supabase replication plugin. Do not fall back directly to a custom mutation queue without documenting why both maintained engines failed.

PowerSync Cloud versus self-hosting is a later deployment decision. A personal production workload would fit comfortably within current free usage limits, but free-instance deactivation makes that tier unsuitable for a trusted daily tool. Cost, privacy, uptime, and maintenance should be revisited only after the local spike establishes technical fit.

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

- Added this evaluation to the technology decision log.
- Recorded PowerSync as the first disposable spike and RxDB as the fallback comparison.
- No runtime code, dependency, database, production service, or configuration was changed.
