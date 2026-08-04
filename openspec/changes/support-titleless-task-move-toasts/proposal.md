## Why

Short transactional feedback does not always need both a title and a content line. BathOS should support concise titleless toasts without leaving title-sized whitespace, and Tasks movement notices should use that presentation when a metadata edit sends work to another list.

## What Changes

- Formalize titleless shared toasts that render one content line with balanced compact padding and no empty title region.
- Preserve content-proportional duration so a short titleless toast displays for one second.
- Change pure Tasks metadata-move notices to use concise content without a title.
- Retain titled feedback for filter-only and mixed departure summaries that communicate more than a simple destination move.
- Add shared renderer, duration, domain, and Tasks integration regression coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `toast-notifications`: Permit shared toasts to render description content without a title while retaining balanced layout and duration behavior.
- `personal-tasks-module`: Present pure metadata-driven task movement feedback as concise titleless content.

## Impact

- Affects the shared toast renderer and its tests.
- Affects Tasks departure-notice formatting and movement-notification expectations.
- Does not alter persistence, task routing, Supabase schema, native companions, or other module toast copy.
