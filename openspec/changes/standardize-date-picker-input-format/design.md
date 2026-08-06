## Context

Most ordinary BathOS date controls use the shared `DatePickerField`, but its default visible format is month-first and one Garage caller overrides it with a longer month-first format. Garage and Snake DataGrids use specialized date-picker triggers to preserve grid navigation. Tasks also has a specialized start picker and semantic date labels, while one Snake creation form still uses a native date input whose displayed format is controlled by the browser.

## Goals / Non-Goals

**Goals:**

- Make every explicit calendar date displayed by a BathOS date-picker input use `YYYY Mon D`.
- Apply the same formatter to specialized DataGrid date-picker triggers without changing their grid behavior.
- Preserve shared picker behavior and intentional semantic Task labels.
- Bring the remaining ordinary native date input under the shared picker contract.

**Non-Goals:**

- Reformat dates in list metadata, calendar headings, previews, reports, or other non-picker displays.
- Change stored ISO calendar dates, parsing, time zones, selection legality, or picker navigation.
- Remove the shared picker's controlled `displayValue` escape hatch.

## Decisions

### Standardize the shared default

Set `DatePickerField`'s default `date-fns` display format to `yyyy MMM d`. Existing callers that do not intentionally supply semantic display text will inherit the contract automatically. Remove the inconsistent Garage override rather than duplicating the same format locally.

Export the same explicit-date formatter for grid-specific picker triggers. This keeps their DataGrid focus and editing contract intact while avoiding duplicated display patterns.

### Preserve semantic values while standardizing explicit dates

Tasks will continue to display Yesterday, Today, Tomorrow, and Someday where those labels communicate more than a literal date. The explicit-date fallback in the Tasks control formatter will use `YYYY Mon D`, ensuring specialized start and deadline picker triggers match the shared picker.

### Replace the remaining ordinary native date input

The Snake creation form's birthday control will use `DatePickerField`. A native `input[type=date]` does not provide reliable author control over its displayed locale format, so retaining it would make the global visual contract impossible to guarantee.

## Risks / Trade-offs

- **Risk:** A caller may rely on the old shared default without a dedicated visual test. **Mitigation:** Search all picker call sites, test the shared default directly, and render representative Tasks and non-Tasks controls.
- **Risk:** Replacing the native Snake field changes its keyboard interaction. **Mitigation:** The replacement uses the already-standard BathOS date-picker contract required for ordinary non-grid forms.
- **Risk:** Grid-specific controls could drift from the shared display again. **Mitigation:** They consume the formatter exported by the shared date-picker field instead of owning format strings.
- **Trade-off:** Semantic relative labels are not literal `YYYY Mon D` strings. They remain because they are intentional control states rather than alternative explicit-date formatting.

## Migration Plan

This is a client-only display change. Publish the updated web client after tests pass. Rollback consists of reverting the formatter and call-site changes; stored values require no migration.

## Open Questions

None.
