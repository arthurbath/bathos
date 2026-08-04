## Why

Empty task lists currently rely on plain text and inconsistent casing, which makes a cleared list feel visually unfinished and weakens BathOS's sentence-case empty-state convention. Search also presents a redundant single bucket heading even though its results can never be divided into multiple buckets.

## What Changes

- Present every empty task list, including Area detail task lists, with a medium Lucide Sparkles icon and a relevant sentence-case message.
- Use the same treatment when an active quick filter produces no visible tasks.
- Keep Search empty states icon-free while standardizing both search guidance messages to sentence case.
- Remove the redundant Tasks bucket heading from the full Search results page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define the shared primary-list empty-state treatment and simplify the full Search results presentation.

## Impact

- Affects Tasks list rendering, task iconography, full Search results rendering, and their focused component tests.
- Does not change task data, routing, filtering semantics, native companions, Supabase objects, or APIs.
