## Context

The server already owns reminder occurrence identity and the Tasks reminder hook claims due in-app deliveries. The current Tasks shell renders those claimed deliveries in an in-page panel. Browser delivery status is already exposed through `useTaskWebPush`, while native companions identify themselves through the Tasks native context but do not yet provide native notification delivery.

The shared toast layer currently limits visible state to one toast and always substitutes a calculated automatic duration. Reminder fallback requires the opposite semantics: every simultaneous delivery must remain visible until the user dismisses that specific toast.

## Goals / Non-Goals

**Goals:**
- Make in-app reminders transient overlays rather than page content.
- Preserve every simultaneous reminder until manual dismissal.
- Avoid duplicate in-app presentation when the active surface can deliver browser or native notifications.
- Keep reminder presentation out of non-Tasks modules.
- Preserve retryable, content-free failure handling.

**Non-Goals:**
- Implement native operating-system notifications.
- Change reminder scheduling, recurrence, or delivery persistence.
- Change the default automatic duration of ordinary BathOS toasts.

## Decisions

### Present claimed reminders from the Tasks shell

The Tasks shell will translate each newly claimed due delivery into one toast. Because the shell exists only on Tasks routes, no reminder toast is created while another BathOS module is active. Toast handles are tracked and dismissed when the shell unmounts so a reminder cannot remain visible after navigation to another module.

### Treat notification state as a presentation decision

The presentation policy has three outcomes:
- defer while notification authorization is still being inspected,
- suppress in-app presentation when browser or native notifications are enabled,
- show the fallback toast otherwise.

Browser notification enablement is the existing active Web Push state. Native companions expose a boolean notification-enabled flag in their injected Tasks context. The flag remains false until native notification delivery is implemented, preventing the bridge contract from falsely advertising unavailable capability. Suppression does not acknowledge the reminder occurrence because provider enablement is not evidence that the user saw the notification, and server acknowledgement intentionally retires every target for that occurrence.

Web Push provider acceptance retires the one-shot reminder intent but preserves the occurrence long enough for an in-app target to claim it. Each browser profile, installed web app, or native companion persists its own stable surface identifier and claims through a delivery target scoped to that identifier. Browser tabs that share local storage intentionally share one browser-surface target so a reminder does not duplicate across tabs, while a ChatGPT browser, Safari profile, and native companion remain independent fallback surfaces. Only surfaces that currently require the in-app fallback poll that delivery channel, so a surface with enabled notifications does not create an unnecessary fallback lease. The in-app claimant remains eligible only when the occurrence has a provider-accepted Web Push delivery and no delivery for the occurrence has been acknowledged. This prevents either Web Push acceptance or a different fallback surface's lease from suppressing presentation on a currently open surface whose notifications are denied, unsupported, or unconfigured.

The client prefers a versioned surface-scoped claim RPC and keeps the legacy account-scoped RPC available for cached clients. Native companions use their injected installation identifier. Browser and installed-web-app surfaces persist a generated identifier in local storage, with a page-lifetime identifier as the storage-unavailable fallback. Manual acknowledgement remains occurrence-wide, so dismissing the reminder on any surface retires every delivery target for that logical reminder.

### Acknowledge on manual dismissal

Closing or swiping a reminder toast acknowledges only that delivery. Merely creating the toast does not acknowledge it. A failed acknowledgement uses fixed content-free destructive feedback and re-presents the persistent reminder so the user can retry without losing it.

### Make persistence and stacking shared toast capabilities

The shared toast reducer will retain all active toasts rather than truncating the list to one. The renderer will honor an explicit duration, allowing reminder callers to use an infinite duration while ordinary callers continue receiving content-proportional defaults. Caller and internal open-change handlers will be composed so domain acknowledgement can run when the toast closes.

## Risks / Trade-offs

- Removing the one-toast cap allows a large burst of feedback to occupy more space. Reminder correctness requires retaining every delivery, and the existing viewport already constrains height and supports stacked layout.
- A native capability flag can drift from operating-system authorization. Native surfaces must only set it true once real native delivery and live authorization inspection exist. Until then, they explicitly inject false.
- A network failure after manual dismissal requires re-presenting the reminder. This is preferable to silently losing an unacknowledged delivery.

## Migration Plan

No existing reminder rows are rewritten. Deploy the versioned surface-scoped database function before publishing the client. The legacy account-scoped function remains available for cached clients, and absent native flags continue to default safely to disabled fallback delivery.
