## ADDED Requirements

### Requirement: iOS Web View Navigation and Scrolling
The iOS companion SHALL disable WKWebView back/forward navigation gestures while preserving native vertical bounce, momentum, and web-owned task drag interactions.

#### Scenario: Swipe horizontally in the native companion
- **WHEN** a horizontal gesture begins on the Tasks web view
- **THEN** WKWebView does not navigate backward or forward through page history

#### Scenario: Scroll and reorder vertically
- **WHEN** the user scrolls a Tasks list or drags an eligible task
- **THEN** the native scroll view preserves ordinary vertical momentum and edge response while the existing task drag interaction remains available

### Requirement: iOS Upcoming Widget Rank
The iOS widget SHALL use the same authoritative Upcoming rank as the web list before truncating its projection.

#### Scenario: Render more than ten Upcoming rows
- **WHEN** Upcoming contains ordinary tasks and recurrence prototypes sharing controlling dates
- **THEN** the widget displays the first ten rows in controlling-date and Upcoming-rank order
