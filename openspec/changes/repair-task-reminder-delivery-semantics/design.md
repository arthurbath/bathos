## Context

The server already owns canonical reminder occurrences and target-specific delivery rows. Browser Web Push is dispatched from that authority, while iOS and macOS currently receive only a bounded future projection through the embedded web view and schedule local UserNotifications. That local projection cannot cover periods when the app has not loaded or synchronized. The delivery-target schema already permits `native_push`, and the project already signs APNs requests for WidgetKit invalidations with a managed token key.

## Goals / Non-Goals

**Goals:**

- Deliver every due reminder to each active iOS and macOS installation whose operating-system notification authorization is enabled.
- Preserve local scheduling as a redundant best-effort path without producing duplicate native banners for one reminder on one installation.
- Keep device tokens owner-scoped, installation-bound, private, revocable, and absent from PowerSync.
- Limit in-app fallback to reminders that become due while the current Tasks session is visibly active.
- Reuse the existing reminder dispatcher schedule and managed APNs signing material.

**Non-Goals:**

- Synchronizing banner dismissal between Apple devices.
- Adding an application-owned notification preference beyond operating-system authorization.
- Sending task content through widget pushes or exposing native push tokens to PowerSync.
- Replacing browser Web Push.

## Decisions

### Use APNs alert pushes as the authoritative native path

The existing reminder dispatcher will claim both Web Push and native-push deliveries from the same canonical occurrence graph. Native pushes use the application bundle topic and a unique target-delivery identifier. Local UserNotification reconciliation remains enabled until the authenticated web surface confirms that the corresponding device token has been accepted by the server. The acknowledgement then disables pending local requests for that installation so the remote and local paths cannot present duplicate banners.

Alternative considered: relying solely on the local projection. Rejected because it cannot guarantee delivery while an app is suspended, stale, or has not opened since the reminder was created.

### Register tokens through an authenticated RPC

After operating-system authorization succeeds, each companion registers for remote notifications and forwards its token, installation ID, platform, environment, and app topic to the trusted embedded Tasks bridge. The authenticated web client calls a narrow SECURITY DEFINER RPC. Token material is stored in a private table keyed to a `native_push` delivery target; clients can read only the non-secret target status.

Alternative considered: sending tokens through the widget credential endpoint. Rejected because the embedded app already has an authenticated owner session and the extra credential exchange would add another lifecycle without improving owner isolation.

### Extend the existing dispatcher

The once-per-minute reminder dispatcher invokes separate Web Push and APNs claims during one run. A missing configuration disables only that channel, and the invocation reports channel-specific processing. Permanent APNs token failures revoke the native target; transient failures retain it for bounded retry.

### Add a server-side session lower bound for in-app claims

A versioned claim RPC accepts both `not_before` and `through_at`. The hook captures a session cutoff when mounted and passes it on every visible claim. The server never leases older occurrences to that surface. Legacy claim RPCs remain for cached clients, but the updated client does not fall back to them because doing so would violate the no-stale-reminders contract.

### Keep dismissal device-local

Apple notification response APIs report explicit dismissal only to the individual app instance and do not provide automatic cross-device removal for ordinary app notifications. BathOS will not build a custom dismissal synchronization protocol until a separate product requirement justifies it.

## Risks / Trade-offs

- [APNs environment or topic mismatch] -> Validate platform, environment, token shape, and exact app topic in both RPC and dispatcher; retire tokens on permanent provider rejection.
- [Duplicate or missing native display during registration] -> Keep local reconciliation active until the server registration RPC succeeds, acknowledge that state back to the native coordinator, and restore local reconciliation after revocation or registration failure.
- [Dispatcher partial failure] -> Claim and record each target independently; keep Web Push and APNs outcome counts separate and retry only nonterminal deliveries.
- [Stale client compatibility] -> Preserve legacy RPCs and local projection while new clients use the versioned registration and claim contracts.
- [Secret exposure] -> Reuse managed Edge Function secrets only; do not place APNs keys, tokens, or dispatcher secrets in committed configuration.

## Migration Plan

1. Apply private native-token storage plus registration, revocation, claim, result, and session-bounded in-app claim RPCs.
2. Deploy the extended dispatcher with existing VAPID configuration and managed APNs token credentials.
3. Verify empty claims, owner isolation, token retirement, and channel-specific receipts before enabling native registrations.
4. Publish and sign native builds with application push entitlements and registration callbacks.
5. Confirm one development and one production token can be registered and that a controlled reminder receives provider acceptance.
6. Roll back by disabling native claim processing and revoking native targets; Web Push, local scheduling, and current reminder data remain intact.

## Open Questions

None. Cross-device dismissal is explicitly deferred.
