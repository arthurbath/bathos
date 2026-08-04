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

### Acknowledge on manual dismissal

Closing or swiping a reminder toast acknowledges only that delivery. A failed acknowledgement uses fixed content-free destructive feedback and re-presents the persistent reminder so the user can retry without losing it.

### Make persistence and stacking shared toast capabilities

The shared toast reducer will retain all active toasts rather than truncating the list to one. The renderer will honor an explicit duration, allowing reminder callers to use an infinite duration while ordinary callers continue receiving content-proportional defaults. Caller and internal open-change handlers will be composed so domain acknowledgement can run when the toast closes.

## Risks / Trade-offs

- Removing the one-toast cap allows a large burst of feedback to occupy more space. Reminder correctness requires retaining every delivery, and the existing viewport already constrains height and supports stacked layout.
- A native capability flag can drift from operating-system authorization. Native surfaces must only set it true once real native delivery and live authorization inspection exist. Until then, they explicitly inject false.
- A network failure after manual dismissal requires re-presenting the reminder. This is preferable to silently losing an unacknowledged delivery.

## Migration Plan

No data migration is required. Deploy the web change and compatible native context addition together or separately; absent native flags default safely to disabled fallback delivery.
