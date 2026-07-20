# Personal Tasks Multi-Client Convergence Validation

**Date:** 2026-07-20
**Category:** Trust / Integration
**Status:** Passed

## Purpose

Validate overlapping task mutations through every active client contract: Raycast capture through the task service, offline web mutation through the local PowerSync repository, and direct MCP mutation through the authenticated service. The test uses only synthetic local accounts and task titles. It does not connect personal task data or a production service.

## Environment

- Local Supabase with the full BathOS migration history
- Self-hosted PowerSync Service 1.23.3
- PowerSync Node SDK 0.19.4 with `better-sqlite3` 12
- The production task schema, repository, Supabase connector, Raycast-aware creation service, and MCP mutation service
- One temporary SQLite file representing the web client

## Executed Matrix

1. Submit the same Raycast capture twice concurrently with one idempotency key.
2. Verify both calls resolve to one task and one accepted creation, with one `created` response and one `already_applied` response.
3. Download the Raycast-created task to the web client and disconnect it.
4. Edit the title in the offline web repository from revision one.
5. Edit the same title through MCP from revision one before the web client reconnects.
6. Reconnect the web client and verify the MCP revision remains authoritative, the stale web patch drains, a content-free local conflict receipt is recorded, and the web projection converges without duplication.
7. Disconnect the web client again, edit the title from revision two, reconnect, and let that current web mutation reach revision three.
8. Submit an MCP edit from stale revision two and verify the service returns a conflict receipt without changing the authoritative web title.
9. Replay the original Raycast capture and verify it resolves to the same task after later edits without creating a duplicate or losing immutable Raycast entry provenance.

## Result

The matrix passed in both winner orders. A current MCP mutation defeated a stale offline web patch, and a current web mutation defeated a stale MCP request. In each case the first accepted revision remained authoritative, the stale mutation returned or recorded a content-free conflict receipt, and the synchronized task converged without duplicate rows.

Raycast currently participates as the supported global capture client rather than as a separate editing client. Its capture uses the same authenticated task service while preserving `raycast` as immutable entry provenance. The test therefore begins with a real Raycast-channel creation and continues overlapping edits through the active web and MCP mutation paths.

## Defect Found and Fixed

### Raycast creation retry comparison

Accepted task-history snapshots intentionally contain mutable task state and omit immutable entry provenance. The creation retry validator incorrectly looked for `entry_channel` inside that snapshot. A real retry, including the loser of two concurrent identical submissions, therefore misclassified the accepted request as a different payload even though only one task existed.

The validator now compares the requested entry channel with the immutable history event's `mutation_channel`, which is the authoritative creation-channel receipt. Unit fixtures mirror the real snapshot shape, and the live concurrent retry proves one logical creation.

## Repeatability

The gate is implemented in `src/modules/tasks/integration/multiClientConvergence.integration.test.ts` and runs with:

```sh
npm run test:tasks:multi-client
```

The disposable service setup and cleanup commands remain in `spikes/tasks-module-reconnection/README.md`.

## Remaining Boundaries

- This gate covers every currently active client contract. A future native editing client must join the same matrix when implemented.
- Backup, export, and restore validation remains task 7.5.
- Sustained parallel use remains task 7.8 and is required before any migration decision.
