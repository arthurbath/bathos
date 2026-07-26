## Context

`DatePickerField` is a shared button-plus-calendar control. Its trigger applies muted text when no date resolves, but also applies a hover foreground-text utility unconditionally. Tailwind's hover rule wins during pointer hover, so the empty-state placeholder changes color even though the field value and interaction state are unchanged.

## Goals / Non-Goals

**Goals:**

- Keep the empty-state placeholder color stable while the date trigger is hovered.
- Apply the behavior to every `DatePickerField` consumer through the shared component.
- Preserve populated values, focus styling, disabled styling, and calendar behavior.

**Non-Goals:**

- Change placeholder wording chosen by individual consumers.
- Change calendar popover behavior or date parsing.
- Introduce a new color token or module-specific override.

## Decisions

- Remove the trigger's unconditional `enabled:hover:text-foreground` utility. Populated values already use `text-foreground`, so they remain visually unchanged, while empty controls continue inheriting `text-muted-foreground` through hover.
- Retain the existing neutral hover background utility because it prevents the shared outline button variant from making date fields look like action buttons.
- Assert the class contract in the shared component test and verify the actual computed color before and during hover in the rendered Tasks drawer.

## Risks / Trade-offs

- [Risk] A consumer-supplied class could still add its own hover text color. → Mitigation: Keep the shared default correct and test the standard shared field contract; intentional consumer overrides remain explicit.
- [Risk] CSS class assertions alone could miss generated-style precedence. → Mitigation: Pair them with rendered computed-color verification through the browser.
