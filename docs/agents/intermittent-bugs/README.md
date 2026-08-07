# Intermittent Bug Log

This folder preserves evidence for observed BathOS defects that cannot yet be reproduced reliably or do not justify a speculative repair. The records let a later investigation compare a new occurrence with earlier reports instead of starting discovery from nothing.

## Workflow

1. Create one dated case file from `TEMPLATE.md` and assign the next sequential `IB` identifier.
2. Preserve the user's exact relevant prompt and a text description of any visual evidence. Record screenshot filenames or other provenance, but do not copy heavy media into this folder.
3. Separate direct observations, verified implementation facts, external research, hypotheses, and ruled-out explanations. Label the confidence of every suspected cause.
4. Record the app surface, operating system, build information when known, sequence of actions, frequency, recovery behavior, and reproduction attempts.
5. Leave the case in `Monitoring` when the evidence does not justify a repair. Define what evidence should be captured if it recurs and what threshold should resume implementation work.
6. When the issue recurs, append a dated occurrence to the original record rather than creating a duplicate. Cross-reference separate cases when their evidence may share a cause.
7. If a cause is confirmed and repaired, mark the case `Resolved`, link the OpenSpec change or commit, record verification, and retain the file permanently.

## Statuses

- `Monitoring`: Observed, but not reliably reproducible or sufficiently understood for a safe repair
- `Investigating`: New evidence makes active diagnosis worthwhile
- `Repair planned`: The cause is sufficiently established and implementation has a defined change contract
- `Resolved`: A repair was implemented and verified
- `Closed - external`: Evidence establishes a platform or dependency defect that BathOS will monitor rather than repair

## Index

| ID | First observed | Status | Surface | Summary |
| --- | --- | --- | --- | --- |
| IB-001 | 2026 Aug 7 | Monitoring | iOS native Tasks app | Dragging a task was followed by a phantom keyboard-sized safe-area gap |
