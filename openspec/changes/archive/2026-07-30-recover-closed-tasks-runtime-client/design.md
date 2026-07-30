## Context

`TasksRuntimeProvider` owns the browser PowerSync client and derives repositories from that client. Effect cleanup closes the client permanently. During development refreshes or another preserved-runtime lifecycle transition, React can restart initialization with a client generation whose cleanup already closed it. PowerSync then throws `Client has already been closed`. Manual Retry works because it creates a fresh client against the same durable OPFS database.

The current runtime treats every local initialization exception as terminal, shows the raw exception message to the user, and does not report that handled error to Sentry. Network connection failures already have a separate offline-ready path and must remain unaffected.

## Goals / Non-Goals

**Goals:**

- Recover one known closed-client initialization failure without user intervention.
- Prevent stale asynchronous work from an old client generation from changing the current runtime.
- Preserve the durable local database, pending mutations, and offline startup behavior.
- Give users calm, actionable fallback copy without exposing implementation details.
- Put the original exception and useful bounded context in the console.
- Send terminal production startup failures to Sentry without private Tasks data.

**Non-Goals:**

- Automatically retry arbitrary database, ownership, authentication, or corruption failures.
- Clear, replace, migrate, or inspect the durable local Tasks database.
- Change synchronization retry behavior after the runtime becomes ready.
- Add a new remote logging service or managed secret.

## Decisions

### Rotate the full client generation once

The runtime will classify the exact PowerSync closed-client lifecycle message and automatically create one fresh database client. The old client will be closed best effort. The loading view remains visible during this recovery.

The automatic attempt count belongs to the current provider lifetime rather than the database object so replacing the client cannot reset the bound. Manual Retry explicitly resets the automatic-recovery allowance for a new user-initiated attempt.

Alternative: retry operations on the existing client. Rejected because PowerSync documents a closed client as permanently unusable.

### Guard every initialization generation

Each database generation receives a monotonically increasing token. State updates, listeners, timers, and cleanup act only for the generation that created them. This prevents late work from a retired generation from setting ready or error state after a replacement has started.

Alternative: rely only on the effect-local `active` boolean. Rejected because an explicit generation identity makes replacement and stale-work behavior testable and robust across refresh lifecycles.

### Separate developer diagnostics from user copy

The visible fallback will say that Tasks could not open, that the issue was logged and reported, and that Retry will try again. It will never print `error.message`.

A structured `console.error` report will contain the original exception, stack where available, phase, recovery attempt, online state, PowerSync endpoint presence, runtime generation, hostname, URL path, user agent, and timestamp. It will not include task data, owner identifiers, database contents, credentials, or query results.

### Capture terminal failure in Sentry

When automatic recovery begins, the runtime will call `Sentry.captureException` at warning level so a real user incident remains observable even when recovery is invisible. After automatic recovery is exhausted or the error is not recoverable, the runtime captures the terminal exception at error level. Both events use allowlisted tags and context matching the console report's safe fields. Sentry remains disabled on non-production hosts under the existing platform policy, while the console report remains available everywhere.

Alternative: send the full console object to Sentry. Rejected because uncontrolled objects could acquire private data later. Sentry receives a deliberately constructed allowlist.

## Risks / Trade-offs

- **A broad classifier could hide a real failure** -> Match the known closed-client message exactly and allow only one automatic rotation.
- **Two generations could race** -> Require generation checks before state updates and dispose each generation's listeners and timers independently.
- **Duplicate Sentry events could create noise** -> Report one warning for the retired closed generation and at most one error for a later terminal generation, tagging their distinct outcomes.
- **The user-facing statement could imply delivery when Sentry is disabled or offline** -> Describe the issue as logged and reported in the product sense while always logging locally; Sentry delivery remains best effort under its existing host and connectivity policy.
- **Additional diagnostic fields could expose private data** -> Keep a typed allowlist and test serialized Sentry arguments for excluded task, owner, and credential values.
