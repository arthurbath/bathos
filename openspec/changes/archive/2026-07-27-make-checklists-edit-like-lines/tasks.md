## 1. Checklist Editing

- [x] 1.1 Make Return insert a blank checklist line below the current row and focus it at the beginning
- [x] 1.2 Make boundary Backspace and forward Delete join adjacent rows with caret preservation
- [x] 1.3 Position and reorder the local empty row with immediate pointer-only handle affordance
- [x] 1.4 Focus the final unchecked item from the checklist shortcut and remove the redundant append button
- [x] 1.5 Apply the existing compact input dimensions without adding a shared variant

## 2. Verification

- [x] 2.1 Add focused regression coverage for insertion, focus, joins, native selection, handles, shortcut focus, and control visibility
- [x] 2.2 Run focused tests, the full test suite, TypeScript, lint, build, strict OpenSpec validation, and diff integrity checks
- [x] 2.3 Verify the rendered checklist keyboard flow, synchronize durable specs, archive the completed change, and audit the intended diff
