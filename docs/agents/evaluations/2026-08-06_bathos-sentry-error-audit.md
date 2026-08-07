# BathOS Sentry Error Audit - 2026 Aug 6

## Scope

This audit covers every unresolved production issue returned by the BathOS Sentry project on 2026 Aug 6, including older issues outside the default 14-day view. The review compared representative Sentry events with current source, production database shape, shipped compatibility work, and recurrence after the relevant fixes.

## Disposition

| Issue | Events | Last seen | Assessment | Action |
| --- | ---: | --- | --- | --- |
| BATHOS-Z | 27 | 2026 Aug 6 | Current. The task-history decoder rejected an authoritative blank-Summary delete snapshot even though blank Summaries are now valid when other meaningful task content exists. A production readback confirmed the event has valid object snapshots and zero-length Summary values. | Fixed locally by allowing empty Summary strings in history snapshots and adding a regression. Keep open until the corrected client is published. |
| BATHOS-T | 13 | 2026 Aug 6 | The warning represented the diagnosed corrupt macOS PowerSync cache incident. The `self-heal-corrupt-task-sync-cache` change now rotates only confirmed corrupt stores with a readable empty upload queue, and its production readback proved current synchronization after recovery. | Resolved. A new degraded episode may reopen it. |
| BATHOS-Y | 1 | 2026 Aug 4 | Superseded local-data startup watchdog failure. Current runtime has bounded corrupt-cache recovery and a fresh authoritative synchronization gate. | Resolved. |
| BATHOS-Q | 11 | 2026 Aug 4 | Earlier group for the same superseded local-data startup failure. | Resolved. |
| BATHOS-W | 1 | 2026 Aug 3 | Legacy numeric checklist order keys were passed to the fractional-indexing generator, which rejected the `0` prefix. Current checklist ordering detects the legacy ranks and generates a compatible key between them, with regression coverage. | Resolved. |
| BATHOS-X | 1 | 2026 Aug 3 | Duplicate report from the same legacy checklist-order interaction as BATHOS-W. | Resolved. |
| BATHOS-V | 1 | 2026 Aug 2 | One unhandled browser timeout with no repeat and no actionable BathOS stack evidence. Current reminder claims use a bounded abortable timeout and normalized error path. | Resolved rather than ignored permanently, so recurrence can reopen it. |
| BATHOS-S | 2 | 2026 Jul 31 | Superseded Tasks asset dereferenced a missing icon presentation. Current task metadata resolves optional presentation icons safely and supplies a fallback where required. | Resolved. |
| BATHOS-R | 2 | 2026 Jul 31 | Superseded template-era recurrence parser rejected a template identifier. Task templates were subsequently eliminated and current recurrence definitions use the v2 prototype model. | Resolved. |
| BATHOS-P | 2 | 2026 Jul 31 | A stale offline SQLite generation lacked `last_operation_id`. The current synchronized schema includes the column and the runtime now has safe generation recovery for an incompatible or corrupt local store. | Resolved. |
| BATHOS-N | 1 | 2026 Jul 31 | Companion write-side form of the same stale checklist schema mismatch as BATHOS-P. | Resolved. |
| BATHOS-M | 3 | 2026 Jul 21 | The first reminder parser rejected PostgreSQL time values carrying synchronized fractional-second precision. The parser was expanded immediately afterward and now has explicit precision regressions. | Resolved. |
| BATHOS-K | 2 | 2026 Jul 21 | Superseded authentication/error handling dereferenced an absent value before lowercasing it. Current classification normalizes optional message, code, and name values to empty strings first. | Resolved. |

## Current Fix Verification

- Production history event `4cfc9477-cf9f-47bb-8124-6238bbd6cee5` is a delete event with valid object snapshots and blank Summary values in both states. No production data repair is warranted.
- `taskHistory.test.ts`, `useTaskUndo.test.tsx`, and `taskHistoryReporting.test.ts` pass with the blank-Summary regression.
- Strict OpenSpec validation passes after extending the blank-Summary contract to synchronized task-history traversal.
- Sentry readback after disposition returns only BATHOS-Z as unresolved in the production project.

## Release Follow-up

Publish the corrected web client, verify that opening Tasks reconstructs the full owner history without a new BATHOS-Z event, then resolve BATHOS-Z. Because Sentry resolution reopens on recurrence, all resolved legacy groups remain effective tripwires for regressions.

## Post-publication Readback

A later live readback on 2026 Aug 6 confirmed that production serves Tasks chunk
`TasksIndex-DSek9GWv.js`. Its task-history decoder accepts an empty Summary string,
while every BATHOS-Z event came from the superseded `TasksIndex-udX-W00M.js`
chunk. No BATHOS-Z event occurred after the corrected decoder was committed and
published, so the issue is ready to resolve without changing production data.

BATHOS-T reopened immediately after a manual resolution because the Mac native
surface still had an active upload-error episode. Its event was a bounded warning,
not an exception: the client had completed a prior synchronization, had no queued
writes, and remained degraded for 2-4 minutes. A fresh native-app readback later
showed Healthy, zero pending changes, and a successful synchronization after the
warning. The episode therefore recovered and the issue is ready to resolve. A new
sustained degradation will reopen the group and preserve its value as an operational
tripwire.
