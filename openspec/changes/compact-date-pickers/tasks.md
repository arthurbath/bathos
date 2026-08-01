## 1. Shared Calendar Density

- [x] 1.1 Reduce shared day-cell height, week spacing, and reserved six-week viewport height without changing calendar width or behavior
- [x] 1.2 Add focused shared-calendar coverage for the compact geometry and preserved six-row contract

## 2. Tasks Start Picker Density

- [x] 2.1 Move Today into a vertical rail beside the four horizon buttons
- [x] 2.2 Use compact heights for Reminder, Clear, and Someday while preserving the existing layout and controls
- [x] 2.3 Extend focused Tasks tests for the compact Today, Reminder, and footer presentation

## 3. Validation

- [x] 3.1 Run focused tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 3.2 Verify the shared Deadline picker and Tasks Start picker in rendered narrow and wide layouts

## 4. Width And Calendar Rhythm Refinement

- [x] 4.1 Contract the Tasks Start picker to the shared calendar width while preserving usable horizon, Reminder, Clear, and Someday controls
- [x] 4.2 Align weekday labels to date-cell geometry and italicize every disabled calendar date
- [x] 4.3 Use the shared small-button height for date-picker Clear actions, including Tasks Deadline
- [x] 4.4 Extend focused coverage for width, weekday geometry, disabled-date styling, and compact Deadline Clear
- [x] 4.5 Run focused tests, TypeScript, lint, build, strict OpenSpec validation, and rendered narrow and wide QA

## 5. Fixed-Grid Keyboard Traversal

- [x] 5.1 Keep arrow focus within the visible six-week day grid and page months only across the horizontal grid endpoints
- [x] 5.2 Add matching outward-arrow paging to month and year navigation controls while preserving selectable limits
- [x] 5.3 Extend focused calendar coverage for adjacent-month focus, vertical exit, endpoint paging, and navigation-control paging
- [x] 5.4 Run focused integration tests, TypeScript, lint, build, strict OpenSpec validation, and rendered keyboard QA

## 6. Selection And Focus Styling

- [x] 6.1 Give committed dates and their committed month the same rounded accent-gray background without a visible selection border
- [x] 6.2 Keep the provisional focus border independent from selected backgrounds and color Today stars by availability
- [x] 6.3 Extend focused coverage for selected, focused-selected, unselected-focused, and disabled-Today states
- [x] 6.4 Run focused tests, TypeScript, lint, build, strict OpenSpec validation, and rendered desktop and mobile QA

## 7. Solid Calendar Colors And Nested Picker Containment

- [x] 7.1 Replace adjacent-month and disabled whole-button opacity with semantic text colors while preserving fully opaque selected backgrounds and focus rings
- [x] 7.2 Right-align the Tasks Deadline picker and reduce the Reminder hour button to a left divider only
- [x] 7.3 Keep Reminder-hour dismissal local to the nested menu so Start and the open task remain visible
- [x] 7.4 Extend focused coverage for adjacent-month selected/focused styling, Deadline alignment, Reminder button borders, and nested dismissal
- [x] 7.5 Run focused integration tests, TypeScript, lint, build, strict OpenSpec validation, and rendered QA

## 8. Reminder Action And Rich Single-Select Menus

- [x] 8.1 Render the Reminder hour button with a stable white enabled icon and no hover treatment
- [x] 8.2 Replace dot indicators with leading checkmarks across shared rich radio-menu primitives while retaining the provisional light-gray row highlight
- [x] 8.3 Add focused coverage for the Reminder button and shared radio-menu indicator convention
- [x] 8.4 Run focused tests, TypeScript, lint, build, strict OpenSpec validation, and rendered QA
