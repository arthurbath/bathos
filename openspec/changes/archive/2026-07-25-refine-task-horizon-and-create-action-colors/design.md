## Context

Tasks already uses one semantic CSS token and one shared icon presentation map for each Today horizon. The floating New Task action is a single shared control in `TasksShell`.

## Goals / Non-Goals

**Goals:**

- Change Inbox to green through the existing shared semantic token.
- Reduce the floating creation action's visual weight while keeping it obvious and touch-friendly.
- Preserve every existing horizon label, icon, creation path, size, position, and accessibility contract.

**Non-Goals:**

- Changing the other horizon colors.
- Changing bucket creation controls or other green success buttons.
- Changing task-creation behavior, persistence, or navigation.

## Decisions

- Keep `text-task-horizon-inbox` as the presentation contract and change only its CSS custom-property value. This preserves one source of truth across Today, task rows, and the Start picker.
- Use the shared button's outline-success presentation for the floating action, with an explicit dark background and green foreground/border. This reuses BathOS semantic styling while preventing a filled success surface from dominating the view.
- Add component assertions for the floating action's semantic variant classes and retain the existing horizon-surface tests.

## Risks / Trade-offs

- [Risk] A dark floating control could blend into the page background. → Mitigation: retain the green border, green plus, large circular shape, fixed position, and accessible name.
- [Risk] A local override could diverge across horizon surfaces. → Mitigation: change only the shared Inbox semantic token.
