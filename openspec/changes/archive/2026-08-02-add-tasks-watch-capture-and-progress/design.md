## Context

Tasks already issues an owner-and-installation-bound native credential to the iOS companion. The iOS and macOS widgets use that credential to read a bounded snapshot and complete tasks without exposing a Supabase session. watchOS cannot read the iPhone app's App Group directly, and WidgetKit controls complication refresh frequency.

## Goals / Non-Goals

**Goals:**

- Capture one nonblank task summary into Today Inbox from the watch system text-entry UI.
- Show a circular completion ring for tasks explicitly started on the owner's planning date, including completed tasks in the denominator and excluding deleted tasks.
- Keep authority owner-scoped, narrow, expiring, revocable, and transferable only through the paired companion.
- Refresh progress when the watch app becomes active and whenever WidgetKit grants a background timeline refresh.

**Non-Goals:**

- Display task lists, edit metadata, complete tasks, browse BathOS, or authenticate independently on watchOS.
- Promise immediate complication updates after every remote mutation; watchOS controls background refresh budgets.
- Add a second task store, a watch-specific account, or a general Tasks API.

## Decisions

### Reuse the native credential and extend it narrowly

The existing credential gains `createInboxTask` and `todayProgress` operations. Both resolve the owner exclusively from the token. Creation accepts only a bounded summary and idempotency identifiers; the server assigns the planning date, Inbox horizon, default actionability, order, and mutation provenance. Progress returns only planning date and integer counts.

This is preferable to transferring a Supabase session, storing a password on the watch, or creating a general mutation endpoint.

### Transfer authority with WatchConnectivity

The iPhone companion activates one `WCSession` coordinator and publishes the current credential through application context. Owner replacement and sign-out replace or clear that context. The watch stores the transferred value in a watch App Group shared only with its complication extension.

This is preferable to relying on the iPhone App Group, which is not a cross-device container, or requiring an independent watch login.

### Use native SwiftUI text entry

The watch app presents a single plus control backed by the system text-input surface. Submitting nonblank text calls the narrow create operation, shows bounded success or failure feedback, and returns to the capture surface.

### Use an accessory-circular WidgetKit complication

The complication renders a standard SwiftUI gauge ring with a checkmark center. Its provider reads cached progress immediately, attempts a bounded network refresh when WidgetKit requests a timeline, and schedules a conservative later refresh. Opening the watch app explicitly refreshes and reloads the complication timeline.

## Risks / Trade-offs

- [WatchConnectivity delivery can be delayed when the phone is unreachable] -> Keep the last unexpired credential locally and present a clear open-iPhone requirement before first provisioning.
- [WidgetKit may defer requested refreshes] -> Never claim live freshness; refresh on app activation and use system-budgeted timelines.
- [The existing credential name refers to completion] -> Preserve the database object for backward compatibility while treating it as native widget authority in new code and specs.
- [A create request can be retried] -> Require client mutation and operation UUIDs and make the RPC idempotent.
- [Progress could expose private task content] -> Return only counts and planning date, never summaries or identifiers.

## Migration Plan

1. Apply one additive migration defining the two service-role-only RPCs without adding replicated tables.
2. Deploy the backward-compatible Edge Function accepting the two new action names.
3. Build and install the iOS app with the embedded watch app and watch complication.
4. Launch the signed-in iPhone app once to transfer authority, then open the watch app and verify capture and progress.
5. Roll back by removing the watch targets and Edge Function routes; the additive RPCs can be dropped independently and existing widgets remain compatible.

## Open Questions

- Physical-watch installation and the exact complication gallery presentation require acceptance testing on the user's paired watch after automatic signing succeeds.
