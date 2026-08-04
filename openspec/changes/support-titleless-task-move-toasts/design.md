## Context

The shared toast API already models `title` and `description` as optional, and the renderer conditionally omits either node. The toast root uses balanced compact padding, while the content wrapper's grid gap produces no space when only one child exists. Tasks departure notices currently always manufacture both a title and description, even for a simple move with one destination.

## Goals / Non-Goals

**Goals:**

- Treat a description-only toast as a supported shared presentation rather than adding a parallel component variant.
- Guarantee that omitting the title leaves no empty title node or title-to-description gap.
- Preserve the existing compact padding, close control, accessibility primitives, and content-proportional duration.
- Use titleless content for pure Tasks moves caused by accepted metadata changes.

**Non-Goals:**

- Convert every existing success or error toast to titleless content.
- Remove titles from filter-only or mixed departure summaries.
- Change toast color, location, motion, stacking, or dismissal behavior.

## Decisions

- Reuse the existing optional `title` API. A separate variant would duplicate a state the shared component already represents and make future maintenance harder.
- Add explicit renderer coverage proving a description-only toast renders one description, no title, the existing root padding, and a one-line duration.
- Make the Tasks departure-notice type's title optional and omit it only for pure movement summaries. Single moves use `The task now appears in <List>.`; grouped pure moves retain their existing destination summary without a title.
- Keep filter-only and mixed summaries titled because those notices can contain multiple concepts or need the filter named prominently.

## Risks / Trade-offs

- [Risk] A caller could provide neither title nor description and render an empty toast. → Preserve the current API for compatibility and keep this change scoped to supported description-only use, with tests that exercise meaningful content.
- [Risk] A destination sentence could wrap on narrow screens. → The existing content-proportional duration accounts for wrapping, while layout remains correct for one content block regardless of line count.
