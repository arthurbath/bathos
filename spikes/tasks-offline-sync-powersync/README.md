# Personal Tasks PowerSync Spike

This disposable application tests the offline and synchronization architecture for the BathOS Personal Tasks module. It uses synthetic accounts and synthetic tasks only. It is not a production module and must not connect to the production Supabase project.

## What It Tests

- Local SQLite reads and writes through PowerSync Web
- Offline task creation and completion
- Browser reload and restart persistence through OPFS
- Reconnection and upload to local Supabase
- Server-originated mutations returning through PowerSync
- Optimistic revision conflicts across two clients
- Fractional manual ordering with stable ID tie-breaking
- Soft deletion and restoration
- Owner-scoped RLS and Sync Streams
- Multi-tab and Safari-compatible storage behavior

## Local Services

From the BathOS repository root:

```sh
supabase start -x vector
docker ps --format '{{.Names}}'
docker cp spikes/tasks-offline-sync-powersync/sql/setup.sql <local-db-container>:/tmp/tasks-spike-setup.sql
docker exec <local-db-container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/tasks-spike-setup.sql
```

The current Supabase CLI sends `db query --file` as one prepared statement, so it cannot apply this multi-statement disposable schema. The container copy plus `psql` path is intentional.

Then start PowerSync and its disposable MongoDB bucket store:

```sh
cd spikes/tasks-offline-sync-powersync
docker-compose up -d
```

Copy `.env.example` to `.env.local` and replace the publishable key with the `PUBLISHABLE_KEY` returned by `supabase status -o env`. The key is a client-safe local development value. Do not add a secret or service-role key.

Install and start the isolated client:

```sh
npm install
npm run dev
```

The client is served at `http://127.0.0.1:5173` and PowerSync at `http://127.0.0.1:8080`.

## Synthetic Accounts

Register two local accounts through the interface, for example:

- `spike-a@bathos.local`
- `spike-b@bathos.local`

Use only synthetic titles. Browser automation may use the `window.tasksSpike` surface to create, update, complete, reorder, delete, restore, connect, disconnect, and read diagnostic state without depending on interface layout.

## Conflict Policy Under Test

Every task mutation increments a revision. Uploads update the server only when the stored revision matches the mutation's base revision. A stale mutation is removed from the upload queue, recorded in the local conflict table without task content, and replaced by the authoritative server state on the next download.

Ordering uses fractional keys. Equal keys are resolved by stable task ID, so every client renders the same total order even when two offline clients generate the same key. Concurrent edits to the same task use optimistic revision detection instead of silently accepting whichever payload arrives last.

## Verified Results

The 2026 Jul 19 spike run passed these cases in Playwright WebKit and real Safari:

- Online and fully offline creation reached Postgres exactly once by stable UUID.
- An offline create and an offline completion survived full browser reloads with their queues intact.
- Server-originated changes downloaded into connected clients.
- Independent installations recorded stale title and completion-versus-title conflicts, drained their queues, and converged to the authoritative row.
- Different tasks moved concurrently into the same gap received the same fractional key and converged to one total `(order_key, id)` order.
- Deletion and restoration converged both when queued together offline and when synchronized as separate revisions.
- Same-origin tabs observed one shared local database and one durable mutation queue.
- A second owner downloaded none of the first owner's rows, could not update them, could not spoof ownership on insert, and left no cached rows behind when the installation switched back to owner A.
- Real Safari created a local task while disconnected, showed a queued mutation, retained the task after reload, and reconnected with a zero queue.

Expected forced-outage diagnostics reported blocked local endpoints without task content. A single connection boolean was not sufficient to explain the write path, so the production module must display queue, upload, download, and conflict state separately.

Run the rollback-only RLS probe with the two synthetic owner IDs and one owner-A task ID:

```sh
docker cp sql/verify-rls.sql <local-db-container>:/tmp/tasks-spike-verify-rls.sql
docker exec <local-db-container> psql -U postgres -d postgres \
  -v owner_a=<owner-a-uuid> \
  -v owner_b=<owner-b-uuid> \
  -v owner_a_task=<owner-a-task-uuid> \
  -f /tmp/tasks-spike-verify-rls.sql
```

## Cleanup

After the evaluation is recorded:

```sh
docker-compose down --volumes
docker cp sql/cleanup.sql <local-db-container>:/tmp/tasks-spike-cleanup.sql
docker exec <local-db-container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/tasks-spike-cleanup.sql
```

The local Supabase stack may remain running for other BathOS work or be stopped separately with `supabase stop`.
