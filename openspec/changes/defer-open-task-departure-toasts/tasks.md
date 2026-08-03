## 1. Editor-Owned Departure Feedback

- [x] 1.1 Resolve the persisted task identifier owned by an ordinary task editor or persisted creation draft
- [x] 1.2 Suppress immediate metadata departure feedback for every mutation owned by the open editor
- [x] 1.3 Preserve final departure classification and toast emission at ordinary-task and creation-draft close

## 2. Regression Coverage

- [x] 2.1 Verify an existing open task changed through the Start picker does not announce departure until close
- [x] 2.2 Verify a persisted creation draft hidden by an Actionability quick filter does not announce departure until close
- [x] 2.3 Run targeted Tasks tests and validate the OpenSpec change
