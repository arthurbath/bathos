## ADDED Requirements

### Requirement: Checklist Completion Feedback
Tasks SHALL acknowledge checklist completion immediately and move the completed row to its final checklist position without a visible intermediate order, synchronization flicker, or repeated motion.

#### Scenario: Complete a checklist item
- **WHEN** a user checks an incomplete checklist item
- **THEN** Tasks immediately shows the item as completed and moves it beneath every incomplete item and after the already-completed items through one smooth position transition

#### Scenario: Synchronize a completed checklist item
- **WHEN** the optimistic completion is confirmed through the local repository and synchronization layers
- **THEN** Tasks retains the same visible checked state and order without restarting, reversing, or replaying the completion transition

#### Scenario: Reject a checklist completion
- **WHEN** persistence rejects an optimistic checklist completion
- **THEN** Tasks restores the prior completion state and order and presents the existing failure feedback

#### Scenario: Complete with reduced motion
- **WHEN** a user who prefers reduced motion checks an incomplete checklist item
- **THEN** Tasks immediately applies the completed state and final order without translating or sliding checklist rows
