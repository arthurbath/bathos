# Data Grid Library Evaluation

## Candidates

### 1. TanStack Table (formerly React Table)
- **Type**: Headless (no UI — you bring your own markup)
- **Bundle size**: ~15KB gzipped
- **Inline editing**: Manual implementation required
- **Keyboard navigation**: Manual implementation required
- **Sorting/filtering/grouping**: Built-in core features
- **Mobile usability**: Fully controllable since you own the markup
- **Customization**: Total control — renders whatever JSX you write
- **Alignment with B&W design system**: Perfect — no opinionated styles to override

### 2. AG Grid Community
- **Type**: Full rendering engine (opinionated)
- **Bundle size**: ~300KB+ gzipped
- **Inline editing**: Built-in, feature-rich
- **Keyboard navigation**: Built-in, Excel-like
- **Sorting/filtering/grouping**: Built-in, advanced
- **Mobile usability**: Mediocre — designed for desktop-first
- **Customization**: Possible but fights the framework's opinions; requires CSS overrides
- **Alignment with B&W design system**: Poor — heavy default styling, difficult to strip

### 3. Glide Data Grid
- **Type**: Canvas-based (renders to `<canvas>`)
- **Bundle size**: ~80KB gzipped
- **Inline editing**: Built-in overlay editors
- **Keyboard navigation**: Built-in, spreadsheet-like
- **Sorting/filtering/grouping**: Manual — not built-in
- **Mobile usability**: Poor — canvas touch handling is limited
- **Customization**: Limited — canvas rendering means no CSS control
- **Alignment with B&W design system**: Moderate — can theme colors but not structure

## Comparison Matrix

| Criteria | TanStack Table | AG Grid | Glide Data Grid |
|---|---|---|---|
| Inline editing | Manual | Excellent | Good |
| Keyboard nav | Manual | Excellent | Good |
| Sort/filter/group | Built-in | Built-in | Manual |
| Mobile usability | Excellent | Poor | Poor |
| Bundle size | 15KB | 300KB+ | 80KB |
| Customization | Total | Limited | Limited |
| Design system fit | Perfect | Poor | Moderate |
| Learning curve | Moderate | Steep | Moderate |

## Recommendation: TanStack Table

**TanStack Table** is the best fit for BathOS because:

1. **Design system alignment**: As a headless library, it imposes zero visual opinions. Every cell, header, and row is standard JSX styled with our Tailwind tokens. No CSS overrides or theme hacks needed.

2. **Mobile-first**: Since we control the markup, we can build responsive table layouts that collapse gracefully on small screens — something AG Grid and Glide fundamentally struggle with.

3. **Bundle size**: At 15KB, it's 20x smaller than AG Grid. For a platform with multiple modules each potentially having data grids, this matters.

4. **Incremental investment**: The manual work for inline editing and keyboard navigation is a one-time investment. Once we build a shared `<DataGrid>` component on top of TanStack Table, every module reuses it. This component becomes part of the platform's shared infrastructure.

5. **No vendor lock-in**: Pure React. No proprietary rendering engine. If we ever outgrow it, migration is straightforward because our UI layer is standard JSX.

**Trade-off acknowledged**: We must build inline editing and keyboard navigation ourselves. This is ~2-3 days of focused work to create a reusable `<DataGrid>` component, but the result will be perfectly tailored to our design language and interaction patterns.

### Implementation Plan (when approved)

1. Install `@tanstack/react-table`
2. Build `src/components/ui/data-grid.tsx` — a shared wrapper with:
   - Inline cell editing (click-to-edit, Enter/Escape/Tab)
   - Arrow key navigation
   - Column sorting (click header)
   - Column filtering (search input per column)
   - Row grouping (collapsible groups)
   - Mobile-responsive layout (card view on small screens)
3. Migrate Budget module's expenses and incomes tables to use the new component
4. Document the component API in the style guide
