## ADDED Requirements

### Requirement: iOS Handle-Owned Reordering
The iOS Tasks companion SHALL allow an exposed web-owned task or checklist drag handle to claim its own touch gesture immediately while the surrounding WKWebView retains ordinary native vertical scrolling and momentum.

#### Scenario: Drag immediately from a handle
- **WHEN** a touch begins on an exposed task or checklist drag handle in the iOS companion
- **THEN** the web interaction prevents native scrolling for that gesture and begins the corresponding reorder without waiting for a long press

#### Scenario: Scroll beside a handle
- **WHEN** a touch begins on the task row, checklist row, editor, or list outside the handle
- **THEN** the WKWebView retains ordinary native vertical scrolling, momentum, and edge behavior

#### Scenario: Do not invoke Quick Find from a handle
- **WHEN** a touch begins on an exposed task or checklist drag handle at the top of the list
- **THEN** the iOS companion reserves that gesture for reordering without engaging the pull-down Quick Find interaction

#### Scenario: Use the same implementation in installed and browser surfaces
- **WHEN** the same Tasks release runs in Safari, an installed PWA, or the iOS WKWebView
- **THEN** the handle gesture uses the same web-owned pointer contract without a separate native reorder implementation

#### Scenario: Target the list edge through blank space
- **WHEN** a handle-owned touch moves above or below the rendered task rows while remaining within the list surface
- **THEN** the web interaction resolves the nearest legal first or final insertion position and keeps that indicator current until release

#### Scenario: Preserve whole-row dragged feedback
- **WHEN** a task is being reordered through a handle-owned touch
- **THEN** the source task's complete summary row uses the shared dragged treatment instead of dimming only its text content
