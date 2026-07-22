## Context

`TasksSyncReliabilityObserver` currently reconciles every derived degradation state into `tasks_sync_health_events` immediately. PowerSync can briefly publish disconnected or transfer-error states while an already synchronized browser reconnects, so a healthy online reload can consume much of the bounded history with zero-duration recovery entries. The visible status and durable event history serve different purposes: current status must be immediate, while history should remain actionable.

## Goals / Non-Goals

**Goals:**

- Keep current synchronization status immediate and accurate.
- Persist only degradation states that survive a short confirmation interval.
- Preserve the original observed time for confirmed episodes and the existing two-minute production report threshold.
- Resume and close an existing durable episode correctly after reload.

**Non-Goals:**

- Change PowerSync connection or retry behavior.
- Hide a current offline or transfer-error state from the interface.
- Change the database schema, retention limit, Sentry payload, or two-minute reporting threshold.
- Delete historical events that were validly recorded by an older client.

## Decisions

### Confirm new degradation states for thirty seconds before persistence

The observer will delay its first reconciliation of an upload error, download error, or offline state for thirty seconds. If the state clears or changes before the timer fires, cleanup cancels that reconciliation and the transient state never enters durable history. The initial five-second candidate failed production acceptance because one ordinary online reload cycled through several zero-queue offline states that each survived that threshold. Thirty seconds remains well below the existing two-minute production reporting threshold while covering the measured reconnect behavior.

The alternative was to special-case startup or `hasSynced` state. That would leave equivalent transient errors during later reconnects noisy and would couple the policy to PowerSync initialization details.

### Preserve the first observation timestamp

When a state survives confirmation, the delayed reconciliation will use the timestamp captured when the state first appeared. Reporting therefore remains due two minutes after the actual onset, not two minutes after confirmation.

The alternative was to timestamp the event when the confirmation timer fires. That would make the public duration contract inaccurate and extend reporting latency.

### Keep recovery reconciliation immediate

Healthy, connecting, first-sync-pending, synchronizing, and local-only states will continue to reconcile immediately. This closes any previously confirmed open event without delay, including an event restored from durable storage after reload. Current UI state remains derived directly from live runtime status and is not gated by event confirmation.

## Risks / Trade-offs

- A real degradation shorter than thirty seconds will not appear in recent reliability history. This is intentional because current state remains visible immediately and the episode clears far below the alert threshold.
- A browser suspended during the confirmation interval may fire the timer late. The original observation timestamp preserves correct duration, and normal state cleanup prevents recording a state that React already observed as cleared.
- PowerSync may emit several degradation categories during reconnection. Each category must remain stable for the full confirmation interval before it can create an event, preventing category churn from fragmenting history.
