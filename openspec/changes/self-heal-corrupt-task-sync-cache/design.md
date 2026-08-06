## Context

The 2026-08-06 incident showed a macOS Tasks client with an empty durable upload queue, a last successful PowerSync download more than ten hours old, and a persistent `download-error` episode. A quiescent `PRAGMA integrity_check` against both the installed store and a complete backup confirmed malformed `ps_oplog` trees and indexes. Production held the newer task revisions and externally created Inbox Manager tasks, while reinstalling the native bundle left the corrupt WebKit store intact.

Healthy Tasks clients already receive cross-surface changes through PowerSync's continuous stream. This change addresses the failure mode where the local synchronized projection becomes corrupt and the stream cannot apply further downloads. The local database is normally disposable, but its durable upload queue can contain the user's only copy of offline mutations.

## Goals / Non-Goals

**Goals:**

- Detect confirmed SQLite corruption from the PowerSync download status.
- Recover automatically when and only when the durable upload queue is proven empty.
- Preserve the damaged database namespace rather than overwriting it.
- Conceal untrustworthy stale rows until a replacement database completes an authoritative sync.
- Apply the shared recovery behavior to browser, macOS WKWebView, and iOS WKWebView surfaces.
- Prove ordinary remote mutations and external inserts converge without reload on a healthy client.

**Non-Goals:**

- Poll Supabase tables alongside PowerSync or create a second synchronization path.
- Repair arbitrary SQLite pages in place.
- Discard or rewrite queued local mutations.
- Change Supabase schema, PowerSync publication, RLS, upload APIs, or native bridge contracts.
- Automatically delete preserved damaged database namespaces.

## Decisions

### Rotate the local database namespace instead of repairing in place

Tasks will persist an installation-local database generation and derive the filename from it. A confirmed corrupt store with no queued uploads advances the generation, closes the damaged client, and constructs a replacement against a new filename. This avoids relying on `REINDEX`, `VACUUM`, or `powersync_clear` against a database whose page graph is already malformed, and it preserves the old bytes for diagnosis.

Changing the global filename constant for every installation was rejected because an offline healthy client could have pending local mutations in the prior namespace.

### Require a readable, empty durable upload queue

Automatic rotation is legal only when `getUploadQueueStats()` succeeds and reports zero operations. A nonzero or unreadable queue leaves the existing namespace untouched and enters the visible recoverable error state. This makes authoritative server reconstruction safe without silently losing user intent.

### Classify only established SQLite corruption signatures

The classifier will inspect the PowerSync download error and its causal chain for bounded SQLite corruption markers such as `SQLITE_CORRUPT`, SQLite code `11`, and `database disk image is malformed`. Ordinary network, authentication, schema, and service errors retain existing retry and offline behavior.

### Keep recovery bounded and content-free

One automatic corrupt-cache rotation is allowed per runtime recovery cycle. During rotation and the replacement database's first current-session sync, Tasks shows its existing loading state. Diagnostic reporting records only the failure class, queue-safety outcome, generation, and recovery result, without owner IDs, task IDs, titles, database contents, or raw source metadata.

### Retain PowerSync as the single convergence path

Healthy clients continue using the continuous PowerSync stream for web edits and external database writes. The native foreground event remains a connection prompt, while the corruption path reacts to an explicit download failure rather than adding direct Supabase polling that could race the local-first repository.

## Risks / Trade-offs

- [Risk] A broad classifier could rotate a healthy cache for a transient failure. -> Mitigation: match only SQLite corruption signatures and require a readable empty queue.
- [Risk] A corrupt database may prevent reading its upload queue. -> Mitigation: fail closed and preserve the namespace for manual recovery.
- [Risk] Repeated corruption could create orphaned local files. -> Mitigation: bound automatic recovery per runtime and retain generations intentionally for diagnosis; future maintenance can add verified cleanup after a retention window.
- [Risk] Two browser tabs may observe the failure concurrently. -> Mitigation: persist the advanced generation before constructing the replacement and make advancement monotonic so both converge on the newest namespace.
- [Risk] A replacement cache briefly has no data. -> Mitigation: retain the online startup freshness gate until the replacement completes its first authoritative sync.

## Migration Plan

1. Ship the generation-aware database factory without changing the default generation, so healthy installations continue using `bathos-tasks-v1.db`.
2. Ship corruption classification, empty-queue gating, bounded rotation, and focused tests.
3. Verify production and local integration convergence without changing the 17-table PowerSync publication.
4. Publish the web application, then rebuild the native companions so their hosted surface can receive the new runtime.
5. Roll back by reverting the runtime behavior. Previously selected healthy generations remain readable because the persisted generation is independent of the application bundle.

## Open Questions

None.
