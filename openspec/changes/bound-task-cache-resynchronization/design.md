## Context

Tasks uses a durable PowerSync SQLite database in each browsing installation. Confirmed SQLite corruption can be recovered safely by moving to a new versioned local database only after proving the old database's upload queue is empty. That recovery currently has an in-memory one-attempt guard, so restarting the app resets the guard and can trigger another complete owner-scoped download. Native macOS and iOS deployment instructions also install verified app bundles, but they do not make cache continuity an explicit precondition or postcondition.

The protection must survive application restarts, must not discard unsynchronized work, and must work without changing task-domain data or PowerSync server configuration.

## Goals / Non-Goals

**Goals:**

- Bound automatic cache replacement to one recovery per application release and no more than one recovery in any rolling seven-day period for an installation.
- Preserve the current cache whenever eligibility, queue safety, or recovery-budget state is uncertain.
- Make a blocked recovery visible and content-free in diagnostics.
- Provide reproducible macOS and iOS upgrade commands that verify signing and identity, never uninstall before upgrade, and verify the durable container did not change.
- Keep the safeguards testable without writing to real Applications directories or installing onto a physical device.

**Non-Goals:**

- Diagnosing or repairing arbitrary SQLite corruption in place.
- Clearing an upload queue, deleting an old database namespace, or automating manual destructive recovery.
- Changing Supabase, PowerSync streams, sync rules, task APIs, or owner authorization.
- Building or installing the native apps during this change.

## Decisions

### Persist a recovery ledger beside the database generation

The web runtime will store a small versioned ledger in installation-local storage containing the successful or committed automatic recovery's release identity, time, and source generation. Local storage is already the durable authority for the database generation and survives ordinary web-view and native-app restarts.

An automatic recovery is allowed only when no ledger exists, or when both the application release differs and at least seven full days have elapsed. Invalid or unreadable ledger data fails closed for automatic recovery.

Alternative considered: retain only the in-memory limit. This does not prevent restart-driven synchronization storms. A server-side limiter was also considered, but it would not stop the client from abandoning its local cache before the server sees the download.

### Commit the budget before creating the replacement database

After the recognized-corruption and empty-queue gates pass, the runtime writes the recovery ledger before advancing the generation and constructing a replacement client. A failed replacement therefore still consumes the automatic budget and requires explicit user intervention instead of looping.

Alternative considered: record only after a successful first synchronization. That permits repeated replacement attempts during startup failures and defeats the transfer circuit breaker.

### Use a build-time release identity with a deterministic fallback

Vite injects a release identity into every build. A deployment may supply `VITE_TASKS_RELEASE_ID`; otherwise the build receives a generated build-time identity. The runtime retains a deterministic module identity only for non-Vite fallback environments. Tests inject release identities and clocks. The identifier is diagnostic and rate-limiting metadata only and contains no user data.

### Treat native deployment as an upgrade transaction

The macOS installer will verify the staged bundle and nested code, capture a fingerprint of the existing Tasks WebKit PowerSync database when present, replace only the application bundle, then verify that the database fingerprint is unchanged before relaunch. It will not uninstall or delete the app container.

The iOS installer will verify the staged bundle, query the installed application and its data-container identity through `devicectl`, install the app in place, then require the same data-container identity afterward. It will not invoke uninstall. If the available Apple tooling cannot expose a stable data-container identity, the script stops rather than claiming cache continuity.

Both scripts accept explicit test roots or command shims so their validation can be exercised without touching a real installation.

Alternative considered: rely on operator discipline and README commands. This leaves the highest-cost invariant unverified and makes accidental uninstall/reinstall easy to repeat.

## Risks / Trade-offs

- [A genuinely corrupt cache cannot recover automatically twice within seven days] -> The runtime preserves it, presents Retry/manual recovery guidance, and records a content-free circuit-open outcome instead of risking repeated full downloads.
- [A malformed ledger could permanently block automatic recovery] -> The ledger is versioned and diagnostics identify the policy failure; manual intervention can inspect or clear only that bounded key after preserving pending work.
- [A native cache changes while being fingerprinted] -> The macOS installer requires Tasks to be closed before capture and comparison.
- [Apple tooling changes its JSON shape] -> The iOS installer validates required fields and fails closed when it cannot prove continuity.
- [A release identifier is not configured] -> Vite generates one per build, while non-Vite fallback environments retain a stable and conservative module identity rather than resetting the budget on every launch.

## Migration Plan

1. Publish the web runtime with the persistent ledger. Existing installations have no ledger and remain eligible for one safe automatic recovery.
2. Use the guarded scripts for subsequent native upgrades. Existing app containers remain in place.
3. If the runtime change must be rolled back, older clients ignore the extra local-storage ledger. Do not clear or decrement the database generation.
4. If an installation script fails, leave the verified installed app and its data container unchanged; the staged build can be retried after correcting the preflight failure.

## Open Questions

None.
