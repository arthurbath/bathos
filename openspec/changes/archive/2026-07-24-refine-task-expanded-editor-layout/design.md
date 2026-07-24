## Context

The expanded to-do editor renders inside the rounded TaskRow card, but `TaskEditor` still adds a top rule, 16-pixel vertical padding, and `sm:ml-14`, conventions that were useful when the editor opened beneath an unbounded list row. Its Notes control uses the older `border-input` token, Actionability and Organization use native `<select>` elements, and the field groups are ordered identity before scheduling. Primary Link uses a generic text input plus a dedicated clear button even though BathOS already uses URL inputs paired with an external-link action.

The task summary is the fixed-height row header and remains the first visual element of the expanded card. The form begins with Title immediately below it.

## Goals / Non-Goals

**Goals:**

- Treat the expanded state as one continuous card without a redundant internal divider or artificial checkbox-column indentation.
- Use the same responsive horizontal padding as the task card while allowing every editor group to fill the available content width.
- Render controls in Summary, Title, Notes, Primary Link, Start, Deadline, Actionability, Organization order.
- Reuse shared BathOS `Select` primitives and align Notes and Primary Link with the standard input border and focus treatment.
- Preserve direct editing, immediate or debounced autosave, keyboard traversal, deep-link support, and source independence.

**Non-Goals:**

- Changing task fields, validation, storage, synchronization, or undo history.
- Reworking the collapsed summary row or the Start and Deadline picker internals.
- Adding explicit Save, Cancel, or Primary Link clear actions.
- Turning the non-grid task form into a two-phase DataGrid editor.

## Decisions

1. **Remove only the obsolete inner chrome.** `TaskEditor` will drop its top border and desktop left margin, use minimal top padding, and match the TaskRow header's responsive horizontal padding. The outer task card remains the sole boundary.

2. **Use the shared Select primitive for non-grid dropdowns.** Actionability and Organization will use `SelectTrigger`, `SelectContent`, `SelectItem`, and grouped labels where applicable. This preserves the standard direct form interaction while gaining the same BathOS trigger border, focus ring, popover, selection indicator, and keyboard behavior used by Budget and other modules.

3. **Adopt the URL visual convention without DataGrid editing semantics.** Primary Link will remain a normal autosaving `Input type="url"` because this is an arbitrary form, not a spreadsheet cell. An adjacent named link control will derive its destination through the existing Tasks Primary Link normalization, open HTTP(S) in a new context, and dispatch `message://` to the operating system. The clear button is removed; users clear the field by editing it.

4. **Make DOM order equal visual and keyboard order.** The temporal pair will render before the identity pair. At narrow widths each pair stacks in the requested sequence; at the desktop breakpoint each pair shares a row while retaining Start before Deadline and Actionability before Organization.

5. **Align Notes with standard form chrome.** The content-editable Notes surface will use the shared grid-line border token and the same focus border plus ring treatment as `Input` and `SelectTrigger`, while retaining its markdown-aware editing implementation.

## Risks / Trade-offs

- **Radix Select tests cannot use native select mutation helpers** -> Update tests to open the trigger and choose named options, and verify autosave payloads.
- **The Primary Link open action may be disabled while text is incomplete** -> Derive the link through the existing Tasks normalization on every render and expose the action only for nonblank values.
- **Reduced top padding may feel cramped with the summary row** -> Keep a small explicit top gap and verify both desktop and narrow viewports visually.
- **Full-width controls increase long-line travel on desktop** -> Retain responsive two-column pairs for scheduling and identity rather than making every structured control a full-width row.
