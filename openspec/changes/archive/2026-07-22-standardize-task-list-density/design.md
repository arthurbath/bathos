## Context

Tasks currently renders count-bearing headings in several components, with most totals embedded as parenthetical text. Its primary task row also renders hierarchy, actionability, temporal, and reminder details as independent blocks, so each populated block adds vertical height.

## Goals / Non-Goals

**Goals:**

- Give all Tasks list and grouping totals one compact, neutral badge treatment.
- Give every collapsed to-do row the same height.
- Retain useful secondary metadata without allowing it to wrap or stack vertically.
- Keep task titles, controls, focus behavior, accessible names, and expanded editors intact.

**Non-Goals:**

- Changing task membership, grouping, ordering, or persistence.
- Changing the height or contents of an expanded task editor.
- Adding a new shared platform-wide badge convention.

## Decisions

### Use a Tasks-local count badge

A small Tasks component will wrap the shared neutral `Badge` primitive and standardize numeric sizing, tabular numerals, and accessible labels. Keeping it inside the module avoids turning a module-specific density choice into a platform-wide contract.

### Fix the collapsed row header at four rem

The interactive header of every primary to-do row will use a fixed `h-16` height. Expanded editor content remains outside that fixed header and continues to animate independently.

### Consolidate secondary metadata into one bounded line

Hierarchy, actionability, start, deadline, and reminder facts will share a single nonwrapping row beneath the title. Each fact remains individually recognizable through its icon, label, and accessible text, while overflow is clipped or truncated horizontally instead of increasing vertical height.

### Normalize secondary task-result rows

Compact to-do rows in area, project, find, and command-search surfaces will also use a fixed height and bounded text lines so the same density rule applies outside the primary planning views.

## Risks / Trade-offs

- [Narrow screens can show less secondary metadata] → Preserve the full title or accessible label on metadata fragments and favor truncation over changing row height.
- [A fixed height can clip unexpectedly tall content] → Keep titles and metadata single-line and test representative rows with and without secondary content.
- [Badge adoption can miss an infrequently used surface] → Centralize the treatment and cover each existing parenthetical Tasks count with component tests and source assertions.
