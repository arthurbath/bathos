## Context

The Tasks web module currently derives a versioned widget snapshot from owner-scoped PowerSync data and publishes it to the native host. The host stores that projection in its App Group container and reloads WidgetKit when the content changes. The WidgetKit provider schedules a new timeline after 30 minutes, but it only re-reads the App Group file. Consequently, a remote edit can remain absent indefinitely until the containing app runs, and the widget exposes that product-specific limitation with an “Open Tasks to Refresh” message after four hours.

The interactive widget rollout already introduced a 90-day owner-and-installation-bound credential, stored natively as a raw token and centrally only as a SHA-256 digest. The `tasks-widget-actions` Edge Function disables platform JWT verification because widget requests use this custom credential, then delegates to service-role-only database functions. That boundary is the narrowest existing place to add snapshot reads without introducing Supabase session material into WidgetKit.

## Goals / Non-Goals

**Goals:**

- Let WidgetKit obtain a current bounded projection during its ordinary system-budgeted timeline refresh without opening Tasks.
- Preserve exactly the same owner, list-membership, quick-filter, area-order, automatic-sort, field-redaction, and projection-size rules used by the web-produced snapshot.
- Continue displaying the last valid local snapshot during offline, timeout, expired-credential, or server-failure conditions.
- Keep refresh authority narrow, revocable, expiring, installation-bound, and absent from PowerSync.
- Remove the app-specific stale-content prompt once a background network refresh exists.

**Non-Goals:**

- Continuous or guaranteed 30-minute synchronization, background execution outside WidgetKit’s budget, or custom push infrastructure.
- A general native Tasks read API, a second native task database, native editing, or access to notes, checklist text, reminder records, Mail source data, or unrelated BathOS data.
- Changing the existing web projection’s public schema or the supported widget lists.
- Deploying production database, Edge Function, web, or signed native artifacts without a separate explicit rollout approval.

## Decisions

### Reuse and broaden the existing widget credential

The existing raw `twc_` credential will authorize two operations only: completing an owned visible task and reading the owner’s bounded widget snapshot. The database continues hashing the raw value, binding it to one owner and installation, enforcing expiry and revocation, and granting its functions only to `service_role`.

This is preferable to placing a Supabase refresh token in the App Group or issuing a second credential because the current credential already has the required lifecycle, storage, rotation, and incident behavior. The active interactive-widget OpenSpec artifacts and documentation will be updated so they no longer claim completion is the credential’s sole authority.

### Build the complete projection inside a private database function

A new `public.tasks_read_widget_snapshot(text)` `SECURITY DEFINER` function will validate the credential and return the final schema-version-2 JSON projection. It will compute the owner’s planning date from `tasks_user_settings`, apply the durable quick filter from `bathos_user_settings`, honor area ordering and automatic list sorting, reproduce Today, Upcoming, Anytime, Someday, and Done membership and ordering, cap each list at 50 tasks, and expose only the existing snapshot fields.

Returning the final bounded projection instead of raw owner rows prevents the Edge Function and native client from receiving fields that widgets do not need. The function will have an empty search path, explicit schema qualification, no `PUBLIC`, `anon`, or `authenticated` execution grant, and a service-role-only grant.

An alternative was to duplicate the web projection builder in the Edge Function. That would make domain behavior drift more likely and would transfer full task rows through another process before redaction. A database-owned projection keeps the security boundary and response size explicit and testable.

### Extend the existing Edge Function with a `snapshot` action

`tasks-widget-actions` will accept `{ "action": "snapshot" }` with `Authorization: Widget <credential>`, invoke the service-role-only snapshot function, and return only a validated snapshot object. Invalid or expired credentials return a content-free unauthorized response. Database or projection failures return a content-free service error.

Platform JWT verification remains disabled because widget credentials are intentionally not Supabase user JWTs. The function body remains responsible for custom authentication, as required by the current endpoint.

### Fetch during timeline generation and keep cache-first fallback

The asynchronous WidgetKit timeline provider will load the current credential, request a snapshot with a short timeout and one transient retry, decode it through the existing strict native schema validator, require its owner to match the credential owner, and atomically store it in the App Group container. The returned timeline entry uses the fresh snapshot when successful and otherwise uses the last accepted local snapshot.

The provider will continue requesting a future timeline after 30 minutes. That time is an earliest requested refresh, not a guarantee, and iOS remains free to coalesce or delay work. Running Tasks and successful widget actions continue to request immediate timeline reloads when they change cached content.

The preview/snapshot provider remains local-only so widget gallery rendering does not trigger remote work.

### Remove the stale prompt rather than replace it

Once the provider can refresh independently, the widget will not display “Open Tasks to Refresh” or another stale-age warning. Temporary network or WidgetKit scheduling delay is ordinary platform behavior, and the cached snapshot remains more useful than an instruction to launch the app.

## Risks / Trade-offs

- **Projection drift between SQL and web behavior** → Add database fixtures covering every list, quick filter, area ordering, automatic sorting, terminal state, and Primary Link redaction, plus parity-oriented examples in web/native tests.
- **Widget refresh exceeds extension time or network budget** → Keep one bounded RPC, a short request timeout, a single transient retry, and a 512 KiB native response ceiling.
- **Credential theft exposes task summaries** → Retain 90-day rotation, owner/installation binding, digest-only central storage, revocation, protected App Group storage, bounded fields, and no notes/checklists/reminder data.
- **Offline refresh fails** → Never clear or overwrite the accepted cache on request, authorization, decoding, owner-mismatch, or persistence failure.
- **iOS delays a requested refresh** → Document the timeline as system-budgeted and avoid claiming real-time synchronization.
- **Active widget OpenSpec changes overlap** → Update their credential wording in the same local change set and validate all active specifications together.

## Migration Plan

1. Add the service-role-only snapshot function without changing tables, task rows, PowerSync membership, or the credential format.
2. Deploy the backward-compatible Edge Function. Older installed widgets continue using completion, while the new `snapshot` action becomes available.
3. Publish the matching web documentation/specification release if required by the coordinated rollout.
4. Install the rebuilt companion and widget. The new provider begins background reads with the already provisioned credential.
5. Run an owner-scoped disposable acceptance fixture that proves owner isolation, list parity, bounded output, invalid/revoked credential rejection, native refresh, and offline fallback, then clean it up.
6. Roll back by reinstalling the prior companion and deploying the prior Edge Function. The additive database function may remain inert or be removed in a follow-up migration after confirming no new widget is using it.

## Open Questions

None for local implementation. Production migration, Edge Function deployment, web publication, signed-device installation, and owner-scoped acceptance remain separate approval gates.
