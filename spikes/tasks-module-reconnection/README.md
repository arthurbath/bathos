# Tasks Module Reconnection Proof

This isolated harness proves restart persistence and later reconciliation for the real BathOS Tasks module against local Supabase and a disposable self-hosted PowerSync service. It uses synthetic accounts and records only. It does not select a production PowerSync topology or change the committed BathOS environment.

Its owner stream and publication mirror the canonical secret-free package under `deploy/tasks-powersync/`. A regression test derives the expected set from the browser client schema and fails if either harness drifts.

## Start

From the repository root, start local Supabase, apply every migration, and install the disposable logical-replication publication:

```sh
supabase db reset --local --no-seed
docker cp spikes/tasks-module-reconnection/sql/setup.sql supabase_db_rsqfokyqntmtdejfwmjs:/tmp/tasks-module-reconnection.sql
docker exec supabase_db_rsqfokyqntmtdejfwmjs psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/tasks-module-reconnection.sql
docker-compose -f spikes/tasks-module-reconnection/docker-compose.yaml up -d
```

Start BathOS with local, client-safe Supabase values and the disposable endpoint supplied as process environment variables. Do not commit those values to `.env`.

The publication and sync rules cover the current task hierarchy, templates, recurrence records, and active reminders needed by the client projection. Delivery credentials and other server-only records remain outside the local projection.

## Automated Offline Workflow Gate

After the services are healthy, run:

```sh
npm run test:tasks:offline
```

The test uses the official PowerSync Node SDK, a temporary SQLite file, a synthetic local account, and synthetic task titles. It proves offline create, edit, reschedule, reorder, completion, delete, restore, generated-occurrence completion, durable queue survival across a database restart, authoritative reconciliation, and a second clean restart. The test clears its local file and signs out when finished. A local Supabase reset removes the disposable remote records.

## Automated Multi-Client Convergence Gate

With the same disposable services running, run:

```sh
npm run test:tasks:multi-client
```

The test begins with two concurrent retries of one Raycast-channel capture, downloads that task to a web client, and then forces overlapping web and MCP edits from the same revision in both winner orders. It proves exact-once capture, first-accepted revision authority, content-free conflict receipts, queue drainage, immutable entry provenance, and convergence without duplicates.

## Automated Preservation and Recovery Gate

With the same disposable services running, run:

```sh
npm run test:tasks:preservation
```

The test creates at least one record in every current portable collection, proves synchronized undo and Trash restoration, serializes a checksummed backup, rejects tampering, deletes the complete synthetic source account, previews and merges restoration into another owner, replays the backup as exact matches, and recovers a task that remained in Trash inside the backup.

## Automated Sustained Parallel-Use Gate

With the same disposable services running, run:

```sh
npm run test:tasks:sustained
```

The default ten-minute gate drives two persistent local clients plus the Raycast-aware creation and MCP mutation services. It alternates offline-web and stale-MCP conflict losers, retries every capture and completion, restarts one local client from its existing SQLite file, and proves final task, history, queue, conflict-receipt, and replica counts. Environment variables may shorten the duration, cadence, and minimum cycle count for smoke testing. Only the default ten-minute run qualifies as endurance evidence.

## Browser Acceptance Exercise

Use a synthetic local account and synthetic task titles only.

1. Open `/tasks/inbox`, make both the PowerSync service and local Supabase gateway unavailable, and create a task.
2. Reload the browser and confirm the task and pending queue remain.
3. Complete the task while still offline, reload again, and confirm completion remains.
4. Reconnect PowerSync and wait for the queue to drain.
5. Confirm Postgres contains one task row at revision two and two accepted history events.
6. Reload once more and confirm the synchronized completion remains visible without duplication.

## Cleanup

```sh
docker-compose -f spikes/tasks-module-reconnection/docker-compose.yaml down --volumes
docker cp spikes/tasks-module-reconnection/sql/cleanup.sql supabase_db_rsqfokyqntmtdejfwmjs:/tmp/tasks-module-reconnection-cleanup.sql
docker exec supabase_db_rsqfokyqntmtdejfwmjs psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/tasks-module-reconnection-cleanup.sql
```
