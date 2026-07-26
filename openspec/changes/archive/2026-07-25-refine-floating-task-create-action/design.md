## Context

Tasks uses a centered `max-w-3xl` main list with `px-4`, while its New Task action is independently fixed to the viewport's right inset. That is appropriate on narrow screens but places the action far beyond the list on wide screens. The shared `outline-success` button variant also supplies a one-pixel border and translucent success hover background, while this action needs a stronger and fully opaque local treatment.

## Goals / Non-Goals

**Goals:**

- Align the fixed action's right edge with the list content's right edge at every viewport width.
- Preserve its current responsive bottom and safe-area offsets.
- Give this action a two-pixel semantic-success outline and an opaque, subtly lighter hover surface.
- Keep the shared button variant unchanged for other consumers.

**Non-Goals:**

- Changing creation behavior, list width, navigation, or selection controls.
- Redesigning other outline-success buttons.

## Decisions

- Place the button inside a pointer-transparent fixed-width boundary wrapper that exactly mirrors the list's `mx-auto w-full max-w-3xl px-4` geometry. A right-offset calculation was considered, but duplicating the layout as a wrapper is easier to verify and remains correct if the viewport is narrower than the list maximum.
- Keep the button itself pointer-enabled and fixed vertically through the wrapper. This preserves its interaction behavior while allowing the wrapper to span the viewport without intercepting unrelated clicks.
- Apply `border-2` and a local important opaque `bg-accent` hover override. The important override guarantees that the shared variant's translucent hover rule cannot win through generated utility order, while `accent` remains a solid dark semantic surface.

## Risks / Trade-offs

- **Risk:** A future Tasks list-width change could leave the wrapper stale.
  **Mitigation:** Keep the matching width/padding classes visible in the component and cover them with a focused regression test.
- **Risk:** A full-width fixed wrapper could obstruct page interactions.
  **Mitigation:** Use `pointer-events-none` on the wrapper and restore `pointer-events-auto` only on the button.
