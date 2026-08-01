## Context

Today horizon headings, Upcoming date headings, and Anytime/Someday Area headings are button controls that create a task in their represented bucket. Each currently renders a small Add Task icon after the heading label even though the entire heading already serves as the activation target.

## Goals / Non-Goals

**Goals:**

- Remove the repeated Plus glyph from every creatable task-bucket heading.
- Preserve the existing button, accessible name, pointer cursor, focus treatment, and bucket-specific creation result.

**Non-Goals:**

- Change the floating New Task button.
- Change bucket heading labels, semantic icons, layout, creation defaults, or drag-and-drop behavior.
- Add replacement helper text or onboarding.

## Decisions

- Remove only the trailing `TASK_ICONS.AddTask` elements from the three bucket-heading renderers. Keeping the existing button wrappers avoids any change to pointer, touch, keyboard, or assistive-technology behavior.
- Retain each heading's semantic leading icon where one exists, such as Today horizon and Area icons. Those icons identify the bucket rather than advertise creation.
- Extend focused Tasks tests to assert that the accessible heading control still creates correctly while no nested Add Task icon is rendered.

## Risks / Trade-offs

- Discoverability decreases intentionally because creation is no longer advertised with a glyph. The persistent floating New Task action remains the primary visible creation affordance.
- A future bucket renderer could reintroduce the icon independently. Focused coverage across Today, Upcoming, and Area headings mitigates this risk.
