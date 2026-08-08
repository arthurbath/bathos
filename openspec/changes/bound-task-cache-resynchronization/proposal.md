## Why

An unexpected Tasks cache replacement or repeated native reinstall can turn one modest owner-scoped dataset into repeated full PowerSync downloads, amplifying normal data into multi-gigabyte transfer. The current automatic corruption recovery limit survives only for one JavaScript runtime, and the native installation paths do not prove that the durable task cache survived an upgrade.

## What Changes

- Persist an installation-scoped automatic cache-recovery circuit breaker across application restarts.
- Permit at most one automatic cache replacement for a given application release and require at least seven days between automatic replacements, while retaining the existing confirmed-corruption and empty-upload-queue gates.
- Fail closed when the circuit is open: preserve the existing cache and pending work, expose a recoverable error, and report content-free diagnostic context rather than attempting another full synchronization.
- Add guarded macOS and iOS installation paths that verify the signed application, use an in-place upgrade rather than uninstalling first, record the installed cache or data-container identity before replacement, and verify continuity afterward.
- Add regression coverage and operator documentation for both protections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Bound automatic disposable-cache recovery across restarts and releases without risking queued user work.
- `tasks-macos-companion`: Require cache-preserving, identity-verified native macOS upgrades.
- `tasks-ios-companion`: Require data-container-preserving, identity-verified native iOS upgrades.

## Impact

This affects the Tasks PowerSync runtime, local recovery metadata, recovery diagnostics, native Apple installation tooling, companion documentation, and focused tests. It changes no Supabase schema, PowerSync stream definition, task API, or task-domain data.
