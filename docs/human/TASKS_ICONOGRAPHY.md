# Tasks Iconography

This document is the canonical Lucide icon reference for durable concepts in the BathOS Tasks module. New Tasks functionality must reuse these mappings rather than select a different glyph for an established concept.

The registry source is `src/modules/tasks/components/taskIconography.ts`. Icons supplement visible text and accessible names; they do not replace them. Generic interaction chrome such as Back, Next, Close, Confirm, ellipsis menus, and ordering arrows follows ordinary BathOS conventions and is intentionally outside this module vocabulary.

## Entities

| Registry Concept | Lucide Icon | Product Meaning |
|---|---|---|
| Task | `SquareCheckBig` | The Tasks module launcher |
| OpenTask | `Square` | An ordinary open task checkbox |
| SomedayTask | `SquareDashed` | A Someday task checkbox |
| CompletedTask | `SquareCheck` | A completed task checkbox |
| Selection | `Circle` | An available task or checklist-item selection control |
| Selected | `CircleCheck` | A selected task or checklist item |
| Area | `Layers3` | An area and the Areas section in Config; this is the three-layer Stack glyph |
| Notes | `NotepadText` | Task Notes contain at least one character |
| TaskChecklist | `ListTree` | A task's checklist |
| Attachment | `Paperclip` | A task attachment |

## Views and Planning

| Registry Concept | Lucide Icon | Product Meaning |
|---|---|---|
| Today | `Star` | The Today view and current date |
| Upcoming | `CalendarRange` | The Upcoming view |
| Anytime | `ListTodo` | The Anytime view |
| Someday | `SquareDashed` | The Someday planning state and view |
| Done | `ListChecks` | The Done view |
| Templates | `LayoutTemplate` | Task templates |
| Config | `Settings` | Tasks configuration |
| Inbox | `Inbox` | Today's Inbox horizon |
| Now | `Clock2` | Today's Now horizon |
| Next | `Clock5` | Today's Next horizon |
| Later | `Clock8` | Today's Later horizon |

## Metadata and State

| Registry Concept | Lucide Icon | Product Meaning |
|---|---|---|
| Reminder | `Bell` | A scheduled task reminder |
| DueReminder | `BellRing` | A reminder that is ready for acknowledgement |
| Deadline | `FlagTriangleRight` | A task deadline |
| PrimaryLink | `ExternalLink` | A task's Primary Link |
| Ready | `CircleCheckBig` | Ready actionability |
| Waiting | `Hourglass` | Waiting actionability |
| Rechecking | `RotateCcw` | Rechecking actionability |
| Canceled | `CircleSlash2` | A canceled task |

## Creation and Task Actions

| Registry Concept | Lucide Icon | Product Meaning |
|---|---|---|
| AddTask | `Plus` | Add a task |
| AddArea | `Plus` | Add an area |
| MultiSelect | `Lasso` | Enter task multi-selection mode |
| Search | `Search` | Search Tasks and views |
| QuickFilters | `Filter` | Apply a predefined quick filter |
| Delete | `Trash2` | Recoverably delete task content |
| Reopen | `RotateCcw` | Reopen terminal task content |

## Sources

Source icons describe provenance. A File source is distinct from a task Attachment.

| Registry Concept | Lucide Icon | Product Meaning |
|---|---|---|
| WebpageSource | `Globe2` | Captured webpage |
| MailSource | `Mail` | Captured Mail message |
| FileSource | `File` | Captured file source |
| SelectedTextSource | `TextQuote` | Captured selected text |
| ReadingItemSource | `BookOpen` | Captured reading item |
| TemplateSource | `LayoutTemplate` | Content created from a template |
| OtherSource | `Link2` | Another structured source |

## Recurrence, Portability, and Synchronization

| Registry Concept | Lucide Icon | Product Meaning |
|---|---|---|
| Recurrence | `Repeat2` | Task recurrence |
| PauseRecurrence | `Pause` | Pause recurrence |
| ResumeRecurrence | `Play` | Resume recurrence |
| RegenerateRecurrence | `RefreshCw` | Regenerate recurrence |
| Archive | `Archive` | Archive a template or recurrence definition |
| DataPortability | `DatabaseBackup` | Backup and restore task data |
| Export | `Download` | Export task data |
| Import | `Upload` | Import task data |
| CloudSync | `Cloud` | Remote synchronization state |
| LocalStorage | `HardDrive` | Local task storage state |
