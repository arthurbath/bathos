## Context

Tasks widgets already read a bounded owner-scoped snapshot with an expiring widget credential during WidgetKit timeline generation, cache only the last valid projection, and ask for another timeline after 30 minutes. That path is correct but entirely dependent on WidgetKit's scheduling budget. WidgetKit push notifications, introduced on Apple OS 26, let the server tell the system that widget content changed without placing private task data in the notification.

The feature spans Swift widget extensions, the existing `tasks-widget-actions` authority, private database state, APNs, and a scheduled Edge Function. The host apps retain their existing deployment targets, while the widget extensions move to iOS 26, macOS 26, and watchOS 26 because WidgetKit does not provide a type-erased or availability-conditional way to attach `WidgetPushHandler` to one configuration while compiling a legacy configuration in the same target.

## Goals / Non-Goals

**Goals:**

- Refresh installed widgets sooner after authoritative task changes, including changes made in the web app or another device.
- Preserve the existing narrow snapshot credential, cache privacy boundary, and authoritative projection.
- Coalesce server changes by owner and respect Apple's opportunistic widget-push budget.
- Keep missed or suppressed pushes correct through existing timeline refreshes.

**Non-Goals:**

- Guarantee instantaneous widget refreshes; WidgetKit retains scheduling and delivery control.
- Put task content, owner identifiers, or authentication material in APNs payloads.
- Replace WidgetKit timelines or the last-valid local cache.
- Commit APNs signing secrets or perform a production migration/deployment as part of local implementation.

## Decisions

### Use WidgetKit push notifications as an accelerator, not the source of truth

OS 26+ widget extensions attach a `WidgetPushHandler`. Token callbacks persist pending registration in the shared App Group and submit it through `tasks-widget-actions` when the widget credential is available. Each list-widget timeline request also reconciles `WidgetCenter.currentPushInfo` with the currently configured widgets so a delayed or missed callback cannot leave a healthy extension silently unregistered. A push causes WidgetKit to request the ordinary timeline, which then fetches the same bounded snapshot used today.

Alternative considered: send task data in the notification. Rejected because it duplicates projection logic, expands private payload exposure, and bypasses the existing validation and cache path.

### Keep registration behind the existing widget credential

Registration is a new action on `tasks-widget-actions`. The database RPC validates the same owner-and-installation-bound credential as snapshot and completion operations, then stores only the APNs token, platform, topic, environment, owner, and installation identity in a private schema. Clients cannot enumerate registrations or dispatch pushes.

### Queue and coalesce invalidations in PostgreSQL

Projection-relevant tables enqueue one owner row in a private outbox. Repeated changes increment a generation instead of generating one notification per row mutation. A service-only claim/ack/nack protocol prevents concurrent dispatchers from losing a newer mutation while an earlier generation is in flight.

### Dispatch through a narrow scheduled Edge Function

`dispatch-task-widget-updates` authenticates a managed cron secret, claims due owner invalidations, signs an ES256 APNs provider token from managed secrets, and sends the canonical WidgetKit payload to each active registration. Invalid APNs tokens are removed. Transient failures are retried with bounded backoff. Push topics are allowlisted to the committed Tasks widget identifiers.

Alternative considered: invoke APNs directly from every mutation path. Rejected because web, recurrence, widget, and future clients would each need push knowledge and could generate bursts.

### Preserve scheduled refreshes on every supported widget platform

The current 30-minute requested timeline policy and cache fallback remain unchanged. Widget extensions require OS 26 so their configurations can attach `WidgetPushHandler` without conditionally changing an opaque `WidgetConfiguration` type. The iOS, macOS, and watchOS host apps keep their earlier deployment targets. Installed OS 26+ widgets still receive scheduled timeline requests because Apple documents widget pushes as opportunistic and budgeted.

Alternative considered: preserve one pre-26 widget extension and conditionally attach the push handler. Rejected because `WidgetBundleBuilder` cannot express the required alternate widget configurations and `WidgetConfiguration` has no public type erasure. A second legacy extension would duplicate the same widget kind and configuration surface on OS 26.

### Reconcile the authoritative snapshot when the host is available

The native host also requests the ordinary credential-backed snapshot when authenticated Tasks content becomes ready and whenever the app becomes active. A successful response atomically replaces any older App Group projection and asks WidgetKit to reload. This closes the gap where a transient foreground PowerSync projection or a withheld WidgetKit timeline can otherwise leave a valid but incomplete cache visible for hours.

Upcoming snapshot builders order mixed ordinary tasks and recurrence prototypes by their actual controlling date first, then their Upcoming rank and stable identity. This preserves deliberate ordering among tasks that share a date while ensuring the bounded leading rows are the genuinely next Upcoming tasks rather than arbitrary rows from a broad month bucket.

Snapshot builders omit legacy or malformed task records whose trimmed Summary is empty. Native validation continues rejecting an invalid payload, but one titleless retired record can no longer poison every otherwise valid list in the shared snapshot or preserve an obsolete cache indefinitely.

## Risks / Trade-offs

- **Apple may delay or suppress a widget push** -> Scheduled timelines and last-valid cache remain authoritative fallbacks.
- **Widgets no longer install on pre-26 systems** -> Host apps remain compatible, but widget availability begins with OS 26, the first release that supports the requested server-triggered refresh path.
- **Push entitlement provisioning may not be enabled for the signing team** -> Build verification reports the capability failure; no native artifact is replaced until signing and entitlements verify.
- **APNs signing material is sensitive** -> Secrets remain in Supabase managed secrets and never enter source, migrations, logs, or widget storage.
- **A trigger can create excessive notification work** -> Owner-level outbox generations coalesce bursts and the dispatcher sends content-free invalidations only.
- **A token changes before widget authority is available** -> The extension stores pending registration in its App Group and retries during later timeline generation.
- **A mutation occurs while a generation is being sent** -> Generation-aware acknowledgement retains the newer queued change.

## Migration Plan

1. Apply private registration/outbox tables, service-only RPCs, and projection invalidation triggers.
2. Deploy the registration-aware `tasks-widget-actions` function.
3. Configure APNs secrets and deploy the dispatcher without scheduling it; run a bounded authenticated smoke test.
4. Build, sign, and install native apps/extensions with the push entitlement, then confirm token registration by owner and installation.
5. Schedule the dispatcher at a conservative one-minute cadence and independently verify APNs acceptance plus subsequent snapshot fetch.
6. Monitor function and database failures. Rollback disables the schedule first; timeline fetching continues unchanged even if registrations and queued rows remain.

## Open Questions

- Production APNs key ID, team ID, and private key must be supplied through managed secrets during deployment.
- A future public distribution build must declare the production APNs environment; current private development installs register against the sandbox environment.
