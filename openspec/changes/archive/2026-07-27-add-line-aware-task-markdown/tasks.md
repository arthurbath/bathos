## 1. Line-Aware Rendering

- [x] 1.1 Track caret and selection line ranges and preserve exact source offsets as lines change presentation
- [x] 1.2 Render inactive supported Markdown semantically while retaining exact source text in the editable DOM
- [x] 1.3 Separate inactive-link navigation from active-line source editing and collapse all source presentation on blur

## 2. Verification

- [x] 2.1 Add focused tests for inactive semantics, active raw source, cross-line selection, links, bullets, caret fidelity, editing, and blur
- [x] 2.2 Run the focused Tasks tests, TypeScript, lint, build, full test suite, and strict OpenSpec validation
- [x] 2.3 Verify source-to-semantic transitions, link behavior, and editing mechanics in the rendered Tasks interface

## 3. Closeout

- [x] 3.1 Sync the delta specification into the durable Tasks spec and archive the completed OpenSpec change
- [x] 3.2 Prove the intended worktree scope while preserving the pre-existing unpushed module-icon commit
