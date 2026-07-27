## ADDED Requirements

### Requirement: Sentence-case status prose
BathOS SHALL render system-authored empty-state "No data" messages and toast message bodies in sentence case while preserving proper nouns, acronyms, canonical product spellings, and user-authored values.

#### Scenario: Empty state has no records
- **WHEN** a list, DataGrid, search result, or other collection has no content to display
- **THEN** its system-authored "No data" message uses sentence case

#### Scenario: Toast includes explanatory copy
- **WHEN** a toast presents a message body beneath its title
- **THEN** the message body uses sentence case

### Requirement: Title-case controls and placeholders
BathOS SHALL render system-authored button labels, input labels, and input placeholders in title case. A system-authored accessible name that serves as the label for a button or input SHALL follow the same title-case rule.

#### Scenario: User encounters a labeled control
- **WHEN** BathOS renders a button or labeled input
- **THEN** its system-authored visible label uses title case
- **AND** an accessible-only control label uses title case when it names that control

#### Scenario: Empty input shows guidance
- **WHEN** an input displays a system-authored placeholder
- **THEN** the placeholder uses title case

### Requirement: Title-case application hierarchy
BathOS SHALL render system-authored module names, page titles, modal titles, card titles, dropdown options, and section headings in title case.

#### Scenario: User enters a module or page
- **WHEN** BathOS displays a module name or page title
- **THEN** the displayed name or title uses title case

#### Scenario: User opens a modal
- **WHEN** BathOS displays a modal title
- **THEN** the modal title uses title case

#### Scenario: User scans page structure
- **WHEN** BathOS displays a heading through an `h1` through `h6` semantic heading or a shared heading component
- **THEN** the heading uses title case

### Requirement: Title-case toast titles
BathOS SHALL render every system-authored toast title in title case regardless of toast severity.

#### Scenario: Application reports an operation result
- **WHEN** BathOS displays a success, information, warning, or error toast
- **THEN** the toast title uses title case

### Requirement: Preserve authored and canonical casing
BathOS SHALL apply the casing policy only to system-authored framing and SHALL preserve user-authored values, proper nouns, acronyms, and canonical product spellings.

#### Scenario: System phrase includes user content
- **WHEN** a governed UI phrase contains a user-authored name or value
- **THEN** BathOS title-cases or sentence-cases only the system-authored framing
- **AND** it preserves the user-authored value exactly

#### Scenario: Phrase includes canonical spelling
- **WHEN** a governed phrase contains a canonical spelling such as `BathOS`, `macOS`, `iOS`, `PowerSync`, `DataGrid`, `CSV`, or `URL`
- **THEN** BathOS preserves that spelling
