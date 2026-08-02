## Context

Tasks builds one normalized search document per to-do and uses that document for both the compact Quick Find palette and the exhaustive Search route. The editable `primary_link` is currently absent from that document even though immutable source URLs are indexed. Recurrence prototypes separately treat their Primary Link as source-URL text, so ordinary tasks and prototypes are inconsistent.

## Goals / Non-Goals

**Goals:**

- Index ordinary task Primary Links for Quick Find and exhaustive search.
- Keep exact, prefix, and substring Summary matches ahead of Primary Link-only matches.
- Represent Primary Link as its own search field so its ranking is explicit and testable.
- Apply the same ranking contract to ordinary tasks and recurrence prototypes.
- Keep completed, canceled, and trashed tasks out of compact Quick Find without removing them from exhaustive Search.

**Non-Goals:**

- Display the matching URL in compact result rows.
- Add fuzzy matching, highlighting, tokenization, or new search filters.
- Change source-provenance matching or task routing.

## Decisions

### Add a normalized Primary Link field to the shared search document

`createTaskSearchDocuments` will normalize `task.primary_link`, include it in the combined searchable text, and expose it to ranking. This keeps Quick Find and exhaustive search behavior aligned. Reusing `normalizedSourceUrl` was rejected because a user-editable shortcut and immutable source provenance have different meanings and may diverge.

### Rank Primary Link-only matches after every Summary match

The existing Summary ranks remain 0 through 2. Primary Link receives an ancillary rank after Summary matching. Existing ancillary fields retain their current relative order. This guarantees the requested Summary-first behavior without disturbing the broader established ranking more than necessary.

### Use the same field shape for recurrence prototypes

Recurrence Quick Find results will put prototype `primary_link` into the new normalized Primary Link field rather than disguising it as a source URL. This preserves current recurrence matching while making the rank contract consistent.

### Separate compact eligibility from exhaustive availability

Quick Find will build ordinary result rows only from present tasks whose lifecycle is open. Full Search will continue to search every task root supplied by `useTaskSearch`, including completed, canceled, and trashed tasks. The `See All Results` action will be driven by matches in the exhaustive ordinary-task document set rather than by the filtered compact rows, so a Done-only query can continue into Search without exposing Done tasks in Quick Find.

## Risks / Trade-offs

- **Risk: Very common URL fragments may add noisy results** -> Primary Link-only hits rank below Summary hits, and compact Quick Find remains limited to the best three results.
- **Risk: Extending the shared index changes exhaustive Search as well as Quick Find** -> This is intentional so See All Results remains a complete continuation of Quick Find.
- **Risk: A Done-only query can make the compact palette appear empty even though exhaustive matches exist** -> Keep `See All Results` visible in that state so the user has a clear path to those matches.
