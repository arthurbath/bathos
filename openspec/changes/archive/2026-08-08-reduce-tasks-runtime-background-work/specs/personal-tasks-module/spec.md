## ADDED Requirements

### Requirement: Idle Tasks runtime efficiency

The Tasks runtime SHALL activate reached planning dates at startup and after the owner-local planning date changes, SHALL retry failed activation, SHALL avoid overlapping planning activations, and SHALL avoid continuous high-frequency upload-queue polling while the queue is empty.

#### Scenario: Client remains open during one planning day
- **WHEN** a Tasks client remains open and the owner-local planning date has not changed
- **THEN** the runtime does not repeat rollover and reached-start-date transactions on every timer tick

#### Scenario: Client crosses midnight or resumes on a new day
- **WHEN** the owner-local planning date advances while the client is open or suspended
- **THEN** the runtime activates the new planning date on the next minute check or native-app activation

#### Scenario: Upload queue is empty
- **WHEN** PowerSync reports no pending uploads
- **THEN** queue-depth polling uses the idle interval while PowerSync status changes can still request an immediate refresh

#### Scenario: Uploads are pending
- **WHEN** the queue contains one or more pending uploads
- **THEN** queue-depth polling uses the active interval until the queue drains
