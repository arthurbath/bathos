## ADDED Requirements

### Requirement: Application content is nonselectable by default
BathOS SHALL prevent ordinary application structure, controls, labels, headings, static values, and read-only user content from being selected through pointer highlighting or browser Select All.

#### Scenario: User drags across ordinary interface content
- **WHEN** the user drags across headings, labels, navigation, cards, rows, or static displayed values
- **THEN** the browser does not create a text selection across that content

#### Scenario: User invokes Select All outside an editor
- **WHEN** the browser owns Select All while no selectable editing or document surface is active
- **THEN** ordinary BathOS page content does not become highlighted

### Requirement: Text editing preserves native selection
BathOS SHALL preserve native text selection within inputs, textareas, and active contenteditable editors.

#### Scenario: User selects text in a form control
- **WHEN** the user drags, shift-selects, or invokes Select All inside an input or textarea
- **THEN** the control's text remains selectable using the browser's normal editing behavior

#### Scenario: User selects text in a contenteditable editor
- **WHEN** a contenteditable BathOS editor is active
- **THEN** its editable text remains selectable using native editing interactions

#### Scenario: User edits a DataGrid cell
- **WHEN** a DataGrid cell enters edit mode
- **THEN** the editor's text is selectable
- **AND** the cell's static display content remains nonselectable after edit mode ends

### Requirement: Legal documents remain selectable
BathOS SHALL treat rendered legal documents as intentional selectable document surfaces.

#### Scenario: User selects legal text
- **WHEN** the user views Terms of Service or Privacy Policy content
- **THEN** the rendered legal-document text can be selected and copied

### Requirement: Native presentation dragging is suppressed
BathOS SHALL suppress browser-native dragging of links and images that are not explicitly designated as draggable while preserving BathOS-owned drag-and-drop interactions.

#### Scenario: User drags a presentation link or image
- **WHEN** the user drags a link or image without an explicit native-drag opt-in
- **THEN** the browser does not begin its native link or image drag operation

#### Scenario: User uses an intentional BathOS drag interaction
- **WHEN** the user drags a Tasks task row, uses a DataGrid resize handle, or interacts with another explicitly implemented BathOS drag surface
- **THEN** the application-owned drag interaction continues to function

### Requirement: Nonselection does not change accessibility or navigation
The content-selection policy MUST NOT disable focus, screen-reader semantics, browser Find, normal link activation, or modified-click link behavior.

#### Scenario: User navigates without pointer selection
- **WHEN** the user tabs through controls, uses assistive technology, searches with browser Find, activates a link, or modified-clicks a link
- **THEN** the interaction behaves as it did before the content-selection policy
