## 1. Search Index And Ranking

- [x] 1.1 Add normalized Primary Link values to ordinary task and recurrence-prototype search documents
- [x] 1.2 Rank Primary Link-only matches below every Summary match while preserving existing ancillary ordering

## 2. Regression Coverage

- [x] 2.1 Add domain tests proving Primary Link inclusion and Summary-first ranking
- [x] 2.2 Add Quick Find integration coverage proving Primary Link-only results appear after Summary results

## 3. Validation

- [x] 3.1 Run focused and full Tasks tests, lint, build, strict OpenSpec validation, and rendered browser QA

## 4. Quick Find Lifecycle Eligibility

- [x] 4.1 Exclude completed, canceled, and trashed tasks from compact Quick Find result rows without changing full Search eligibility
- [x] 4.2 Derive `See All Results` availability from exhaustive task matches so Done-only queries can continue to full Search
- [x] 4.3 Add regression coverage for Quick Find exclusion and full Search inclusion of Done tasks
- [x] 4.4 Run focused and full Tasks tests, lint, build, strict OpenSpec validation, and rendered browser QA
