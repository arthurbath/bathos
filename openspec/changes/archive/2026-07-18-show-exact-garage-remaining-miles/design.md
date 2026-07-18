## Context

`GarageDueView` currently converts every non-zero remaining-mile value into a rounded count of thousands before rendering it. That presentation can display `1k miles left` for substantially different values and obscures whether a service actually falls within a vehicle's configured horizon.

## Goals / Non-Goals

**Goals:**

- Render the absolute remaining-mile value as a comma-delimited integer with no abbreviation or decimals.
- Preserve due/upcoming classification, primary-reason selection, and singular/plural status wording.
- Cover future, due-now, and overdue mileage presentation with focused tests.

**Non-Goals:**

- Change the mileage calculations or bucket classification rules.
- Change the formatting of odometer readings elsewhere in Garage.
- Change time-based status formatting.

## Decisions

### Format only at the Due view presentation boundary

Replace the thousands-abbreviation helper with an `Intl.NumberFormat` configured for zero fraction digits and comma grouping. Keeping this in `GarageDueView` avoids changing stored values or calculation precision and limits the behavior to the requested screen.

Formatting before absolute-value status composition was considered, but the existing status helper already owns sign-to-word conversion (`left` versus `overdue`), so it remains the narrowest place to format the displayed magnitude.

### Keep exact values for classification

No change is needed to `useGarageDue` or `dueMath`: those paths already classify against the numeric remaining mileage. The regression test will distinguish a value such as 1,250 from its former `1k` label to prove that presentation no longer implies thousand-mile rounding.

## Risks / Trade-offs

- [Large values take more horizontal space than abbreviated labels] → Service cards already allow normal text flow, and exact mileage is more important than compactness on this screen.
- [Fractional calculated mileage could appear inconsistent] → Round only the rendered value to zero decimals as requested while leaving the underlying calculation unchanged.
