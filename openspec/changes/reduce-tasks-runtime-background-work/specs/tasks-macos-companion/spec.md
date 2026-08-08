## MODIFIED Requirements

### Requirement: Long-running native Tasks sessions

The macOS companion SHALL keep the embedded Tasks runtime connected without repeatedly issuing state-neutral planning transactions or high-frequency empty queue reads throughout an idle long-running session.

#### Scenario: Native app remains open all day
- **WHEN** the native Tasks window remains open without pending uploads
- **THEN** the shared runtime uses date-change-only planning activation and idle queue polling

#### Scenario: Native app resumes after midnight
- **WHEN** the native app becomes active after the planning date has advanced
- **THEN** the shared runtime immediately checks and activates the new planning date
