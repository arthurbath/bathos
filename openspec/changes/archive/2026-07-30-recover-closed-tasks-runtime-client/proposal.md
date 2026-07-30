## Why

Tasks can occasionally attempt to initialize a PowerSync client after that client has been closed, leaving the user on a technical error screen even though creating a fresh client normally recovers immediately. The runtime should repair this known disposable-client lifecycle failure automatically and reserve the visible fallback for failures that still require user intervention.

## What Changes

- Automatically rotate to one fresh Tasks PowerSync client when initialization fails because the current client has already been closed.
- Bound automatic recovery to one attempt so repeated or unknown failures remain visible and retryable.
- Replace raw exception messages in the Tasks startup fallback with calm user-facing copy that says the issue was logged and reported.
- Print a structured diagnostic report with the original exception and bounded runtime context to the browser console.
- Capture terminal startup failures in Sentry with useful runtime context while excluding task content, database contents, owner identifiers, and other private data.
- Keep manual Retry available and make it construct a fresh client generation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add automatic recovery for a closed local client and define the user-facing, console, and Sentry behavior for terminal Tasks startup failures.

## Impact

- Tasks runtime initialization and client lifecycle management in `src/modules/tasks/runtime/`.
- Existing BathOS Sentry reporting integration.
- Focused Tasks runtime recovery, privacy, and fallback UI tests.
- No database schema, PowerSync table, Supabase API, or native companion changes.
