## ADDED Requirements

### Requirement: Apple widget empty states use celebratory centered presentation
The shared iOS and macOS large-widget renderer SHALL present a current empty task list with the closest native Sparkles symbol and sentence-case message centered in the available body area.

#### Scenario: Render a current empty large widget
- **WHEN** the configured Today, Upcoming, Anytime, or Someday projection contains zero tasks
- **THEN** the widget shows the native Sparkles-equivalent symbol above or beside the sentence-case empty message as one centered group below the header and above the widget bottom

#### Scenario: Preserve a missing-projection prompt
- **WHEN** no valid owner-scoped projection exists
- **THEN** the widget retains the existing prompt to open Tasks and does not misrepresent the missing projection as an empty list

### Requirement: Lock Screen task typography matches Calendar
The iOS rectangular Lock Screen widget SHALL render every task Summary with the native default system typeface at 13 points and regular weight without an additional scale reduction.

#### Scenario: Render compact Lock Screen task rows
- **WHEN** the Lock Screen widget renders one, two, or three task summaries
- **THEN** every Summary uses the same 13-point regular system treatment as Calendar's event-title text and remains legible within the accessory rectangular family
