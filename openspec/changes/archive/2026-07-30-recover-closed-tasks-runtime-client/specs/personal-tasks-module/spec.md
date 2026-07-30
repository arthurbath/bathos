## ADDED Requirements

### Requirement: Recoverable Tasks runtime startup
The Tasks module SHALL automatically replace a local database client that is discovered to have already been closed during startup, SHALL bound that automatic recovery to one attempt per startup episode, and SHALL preserve the durable local database and queued mutations.

#### Scenario: Closed client is replaced automatically
- **WHEN** Tasks initialization fails because its PowerSync client has already been closed
- **THEN** Tasks keeps the loading view visible, retires that client generation, creates one fresh client against the same durable local database, and retries initialization without asking the user to intervene

#### Scenario: Replacement client opens successfully
- **WHEN** the one automatic replacement initializes successfully
- **THEN** Tasks opens normally without showing an error and without clearing local task data or pending mutations, while retaining the content-free console and production Sentry report of the recovered incident

#### Scenario: Automatic replacement also fails
- **WHEN** the replacement generation fails to initialize or an initialization failure is not the recognized closed-client condition
- **THEN** Tasks stops automatic recovery and presents a manual Retry action without entering an automatic retry loop

#### Scenario: Retired initialization finishes late
- **WHEN** asynchronous work from a retired client generation finishes after a replacement generation has begun
- **THEN** the retired generation cannot alter the current loading, ready, error, synchronization, timer, or listener state

### Requirement: Tasks startup failure communication
The Tasks module SHALL present terminal startup failures in user-facing language, SHALL log a developer diagnostic report locally, and SHALL report the handled failure to the configured production Sentry client without including private Tasks data.

#### Scenario: Terminal startup failure reaches the user
- **WHEN** Tasks cannot recover from an initialization failure
- **THEN** the interface says that Tasks could not open, says that the issue was logged and reported to the webmaster, and offers Retry without displaying the raw exception message

#### Scenario: Developer inspects the console
- **WHEN** a terminal Tasks startup failure occurs
- **THEN** the console receives the original exception and a structured report containing bounded lifecycle, environment, and timing context but no task content, database contents, owner identifier, credential, or query result

#### Scenario: Production Sentry is available
- **WHEN** a closed-client automatic recovery begins or a terminal Tasks startup failure occurs and the production Sentry client is initialized
- **THEN** Tasks captures the original exception once for that client generation with allowlisted module, phase, outcome, recovery, connectivity, and environment context, using warning level for automatic recovery and error level for terminal failure

#### Scenario: Sentry is unavailable
- **WHEN** a terminal Tasks startup failure occurs without an initialized Sentry client or while event delivery is unavailable
- **THEN** the local console report and manual Retry remain available and Tasks does not block recovery while waiting for telemetry

#### Scenario: User retries
- **WHEN** the user activates Retry after a terminal startup failure
- **THEN** Tasks creates a fresh client generation, returns to the loading view, and allows one bounded automatic closed-client recovery within the new user-initiated startup episode
