## 1. Search Contract

- [x] 1.1 Include retained Done task roots in Quick Find without changing relevance-first ranking or the three-result limit
- [x] 1.2 Label Quick Find Done results as Completed or Deleted and route them to Done
- [x] 1.3 Cover Done inclusion, labels, ranking, and navigation with focused tests

## 2. Permanent Deletion Authority

- [x] 2.1 Create a migration extending permanent-deletion scope to completed and canceled retained task roots while rejecting active tasks
- [x] 2.2 Extend permanent-deletion service and database tests for every eligible terminal state and existing safety guards

## 3. Done Interface

- [x] 3.1 Add Delete Permanently... beside Reopen in each Done task menu
- [x] 3.2 Add a server-previewed confirmation dialog with pending, failure, cancellation, and successful-convergence behavior
- [x] 3.3 Add subtle Done footer copy explaining permanent deletion after 30 days
- [x] 3.4 Cover Done menus, non-destructive cancellation, successful deletion wiring, and footer copy with component tests

## 4. Verification

- [x] 4.1 Run targeted Tasks unit and integration tests for search, permanent deletion, and Done actions
- [x] 4.2 Run lint, production build, database lint/tests where available, and strict OpenSpec validation
- [x] 4.3 Exercise Quick Find and the Done permanent-deletion confirmation in the local rendered app without deleting real user data
