## Why

Quick Find currently searches task summaries and several ancillary fields but omits the editable Primary Link. Users who remember a destination URL or protocol-specific link cannot use that value to recover the related task.

## What Changes

- Include task Primary Link values in Quick Find and complete task-search matching.
- Rank every Summary match ahead of a task that matches only through its Primary Link.
- Preserve the established exact, prefix, and substring priority among Summary matches.
- Exclude completed, canceled, and trashed tasks from compact Quick Find results while retaining them in exhaustive Search results.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand Global Task Quick Find matching to Primary Links, retain Summary-first ranking, and separate compact active-task eligibility from exhaustive lifecycle search.

## Impact

- Tasks search-document indexing and ranking in `src/modules/tasks/domain/taskSearch.ts`.
- Quick Find and full task-search results that consume the shared search documents.
- Focused Tasks search regression coverage.
- No database, Supabase, native companion, dependency, or API changes.
