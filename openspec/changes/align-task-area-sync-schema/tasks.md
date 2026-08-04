## 1. Align Area Synchronization

- [x] 1.1 Remove unsupported operation metadata from the local Area schema and repository create/update writes while preserving checklist operation grouping.
- [x] 1.2 Make the upload connector reject unexpected Area operation metadata locally and cover the Area/checklist distinction with focused tests.

## 2. Verify Preservation

- [x] 2.1 Keep an explicit no-rejected-writes assertion in the preservation integration setup.
- [x] 2.2 Run focused repository, schema, connector, preservation, lint, typecheck, and strict OpenSpec validation gates.
