## MODIFIED Requirements

### Requirement: Task Primary Link actions use canonical external-link iconography
Tasks SHALL use canonical protocol-specific identity icons for Primary Links in task rows, the metadata-editor decoration, and native widgets, defaulting to Lucide `Link2` or its closest native equivalent. Task-row and native-widget Primary Link identity icons SHALL use the semantic blue link treatment, while the metadata editor's adjacent launch action SHALL always use Lucide `ExternalLink`.

#### Scenario: Show a generic Primary Link
- **WHEN** a task has a generic HTTP or HTTPS Primary Link
- **THEN** its task-row and metadata-input decoration use Lucide `Link2`, its widget representation uses the closest native chain-link symbol, and the task-row and widget identity icons use their platform's semantic blue link color

#### Scenario: Show a Mail message link
- **WHEN** a task Primary Link uses the recognized Mail message protocol
- **THEN** the task row, metadata-input decoration, and widget retain the established Mail message icon, and the task-row and widget identity icons use their platform's semantic blue link color

#### Scenario: Show a Jira link
- **WHEN** a task Primary Link uses the Jira protocol or a recognized Jira HTTP or HTTPS URL
- **THEN** every task-row and metadata-input decoration uses Lucide `Zap`, native widgets use the closest native system rendering, the task-row and widget identity icons use their platform's semantic blue link color, and activation opens the configured browser or registered Jira application as appropriate

#### Scenario: Show an Obsidian link
- **WHEN** a task Primary Link uses the Obsidian protocol
- **THEN** every task-row and metadata-input decoration uses Lucide `FileText`, native widgets use the closest native system rendering, the task-row and widget identity icons use their platform's semantic blue link color, and activation opens the registered Obsidian application

#### Scenario: Keep the launch action stable
- **WHEN** a nonblank Primary Link appears in an expanded task
- **THEN** the activation control beside the Primary Link input always uses Lucide `ExternalLink` regardless of the Primary Link's identity icon

#### Scenario: Omit the Primary Link slot after clearing a captured link
- **WHEN** a task retains Mail or other typed source provenance but its editable Primary Link is null, blank, malformed, or otherwise not actionable
- **THEN** its task row renders no icon in the Primary Link slot and does not synthesize an icon from source provenance
