## Context

Task bulk selection currently uses circular controls but gray row highlighting, while checklist multi-selection uses blue row highlighting but retains completion checkboxes. The nested checklist interaction must continue exposing completion through text treatment while selection owns the checklist controls.

## Goals / Non-Goals

**Goals:**

- Reuse one canonical pair of selection icons and one semantic blue selected-row color.
- Make checklist selection controls toggle selection without mutating completion.
- Preserve the gray expanded-task surface and animate the background-color transition when a focused task opens.
- Keep assistive names and checkbox state aligned with the control's current selection or completion role.

**Non-Goals:**

- Changing how task or checklist selection begins, extends, or clears.
- Adding checklist bulk completion.
- Changing persisted task or checklist data.
- Changing drag-and-drop behavior.

## Decisions

- Add `Selection` and `Selected` concepts to the Tasks iconography registry, mapped to Lucide `Circle` and `CircleCheck`, so task and checklist selection cannot drift independently.
- Pass checklist selection-mode state into each persisted row. Outside selection mode, its leading control remains the ordinary completion checkbox. Inside selection mode, the same position becomes a selection checkbox with Select/Deselect naming and toggles only the transient selected-item set.
- Retain `line-through` and muted text from persisted completion independently of which leading control is rendered.
- Use `bg-info/20` for closed whole-task focus and explicit selection. An open task uses the existing `bg-foreground/[0.05]`; the existing background-color transition supplies the requested fade.
- Apply the shared blue treatment to active and terminal task lists so selection meaning does not vary by view.

## Risks / Trade-offs

- [A checklist control changes meaning while selection is active] → Keep its accessible label and `aria-checked` state aligned with selection, while completion remains visibly encoded in the item text.
- [Tailwind background utilities compete during the open transition] → Derive one mutually exclusive row-state class with open gray taking precedence over blue focus or selection.
- [Selection can become empty from the last checklist control] → Clear the selection anchor with the last selected item so ordinary completion controls return immediately.
