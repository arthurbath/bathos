## 1. Checklist Interaction

- [x] 1.1 Change the checklist-item placeholder to `Item`
- [x] 1.2 Make unmodified Return commit the current row, create one following checklist row, focus it, and keep the task open
- [x] 1.3 Preserve input-method composition and prevent duplicate pending row creation

## 2. Verification

- [x] 2.1 Add component regression coverage for the placeholder and Return behavior
- [x] 2.2 Run focused tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 2.3 Synchronize and archive the completed change, then verify the intended diff excludes the unrelated icon source
