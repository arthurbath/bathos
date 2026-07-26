## Context

The first compact mobile metadata pass reduced width, but the remaining free-floating icon and day text lack enough visual grouping. The expanded editor can also use a small horizontal breathing-space adjustment, and the live Markdown source currently colors an entire Markdown link blue rather than differentiating its label, delimiters, and destination as shown in the Things reference.

## Goals / Non-Goals

**Goals:**

- Group mobile actionability and Deadline metadata into quiet, low-contrast chips.
- Use complete `days` units without returning to verbose relative phrases.
- Increase expanded-editor horizontal padding subtly at mobile and larger widths.
- Make Markdown syntax visually subordinate to content.
- Keep Markdown link labels white and URL destinations blue.

**Non-Goals:**

- Changing task metadata semantics, desktop metadata wording, or row height.
- Hiding Markdown source characters or introducing a separate preview mode.
- Changing URL safety, link activation, autosave, or caret preservation.
- Reproducing Things branding or exact proprietary colors.

## Decisions

- Use a low-contrast semantic foreground tint, compact horizontal padding, and a small radius for mobile chips. Remove that chip treatment at the standard small breakpoint so desktop keeps its current inline metadata.
- Keep complete accessible names on metadata items and mark responsive visual variants as presentation-only.
- Change the compact date formatter from the abbreviated `d` unit to the complete `days` unit for every signed offset.
- Increase the task editor form inset by one small spacing increment while preserving the task container and field widths.
- Apply `text-muted-foreground` to the existing fixed-width Markdown indicator class. Split Markdown links into white label text, muted delimiters, and a semantic-blue URL span while retaining one clickable anchor and identical source text.
- Keep inline code content and background treatment intact while rendering its backtick delimiters through the shared muted indicator style.

## Risks / Trade-offs

- **Risk: chips may increase metadata height** -> Use compact padding that remains within the fixed 44-pixel task row.
- **Risk: the full `days` unit consumes more width** -> The chip and icon-only actionability treatment still use substantially less space than the original prose.
- **Risk: nested link colors could obscure clickability** -> Keep the entire source inside one anchor with pointer behavior and a blue destination.
- **Risk: splitting inline code changes source reconstruction** -> Preserve exact text-node order and cover editor retokenization with existing and new tests.
