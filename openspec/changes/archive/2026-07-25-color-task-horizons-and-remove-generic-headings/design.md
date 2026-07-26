## Context

The same four Today horizon concepts are rendered in three places: Today section headings, task-row markers in planning lists, and Start-picker choices. Those surfaces currently duplicate Lucide icon selection and do not share a semantic color contract. Anytime, Someday, and Done also wrap ordinary task rows in a visually labeled Tasks section even though the route heading already supplies that context.

## Goals / Non-Goals

**Goals:**

- Establish one Tasks-owned presentation definition for each Today horizon, including label, Lucide icon, and semantic text-color class.
- Apply the shared presentation to Today headings, task-row markers, and Start-picker choices.
- Flatten ordinary task rows in Anytime, Someday, and Done without removing the outer accessible view landmark or meaningful grouped content.
- Preserve all task ordering, creation, focus, selection, and keyboard behavior.

**Non-Goals:**

- Recolor task titles, backgrounds, selection states, reminder symbols, or deadline symbols.
- Remove Today horizon headings, Upcoming date headings, Deleted headings, or project grouping.
- Change horizon data, planning rules, or synchronization behavior.

## Decisions

### Use Tasks-specific semantic color tokens

Add four HSL custom properties and expose them through named Tailwind colors. This keeps raw color values out of React components while allowing the requested identities to be tuned centrally:

- Inbox: blue
- Now: yellow
- Next: red-orange
- Later: reddish-purple

Using the general `info`, `warning`, `destructive`, and `admin` tokens was considered, but those colors communicate application-wide status meanings and do not precisely represent the requested red-orange and reddish-purple horizon identities.

### Centralize horizon presentation metadata

Create a Tasks-local presentation definition that owns each horizon's label, Lucide icon, and semantic color class. Today headings, task rows, and the Start picker will consume that definition rather than maintaining separate icon and color conditionals.

### Remove only the redundant visual heading

Anytime and Someday ordinary rows will remain inside the existing view landmark and task-list container, but the nested Tasks heading will be removed. Done will preserve Deleted and project groupings while rendering ordinary task rows in an unlabeled nested section with an accessible `aria-label`. This avoids changing focus, selection, or list-query behavior.

## Risks / Trade-offs

- [Color becomes a recognition aid that some users cannot perceive] -> Preserve the existing distinct Lucide icons, visible labels in headings and the picker, and accessible horizon names on row markers.
- [Removing a heading could weaken document structure] -> Retain the outer view landmark and an accessible label on the nested task section.
- [Shared presentation refactoring could alter horizon behavior] -> Keep data values and event handlers unchanged and cover all four mappings with component tests.
