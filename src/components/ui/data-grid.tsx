import * as React from 'react';
import { useState, useRef, useCallback, useContext, createContext, useEffect } from 'react';
import {
  flexRender,
  type Table as TanStackTable,
  type Row,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GRID_ACTIONS_COLUMN_ID } from '@/lib/gridColumnWidths';

// ─── Column Meta Augmentation ───
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    headerClassName?: string;
    cellClassName?: string;
    containsEditableInput?: boolean;
    containsButton?: boolean;
  }
}

// ─── Context ───
interface DataGridContextValue {
  rowIndex: number;
  rowId: string;
  onCellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => boolean;
  onCellMouseDown: () => void;
  onCellPointerDown: () => void;
  onCellCommit: (col: number) => void;
}

const DataGridCtx = createContext<DataGridContextValue | null>(null);
export function useDataGrid() { return useContext(DataGridCtx); }

export const GRID_HEADER_TONE_CLASS = 'bg-border';
export const GRID_READONLY_TEXT_CLASS = 'text-[hsl(var(--grid-text))]';
// Shared null-state affordance for grid controls. Override per cell only when a more specific prompt is necessary.
export const GRID_NULL_PLACEHOLDER = '—';
// Use on button controls rendered inside grid cells to match hover border treatment of other grid inputs.
export const GRID_CONTROL_HOVER_BORDER_CLASS = 'border-transparent hover:border-[hsl(var(--grid-sticky-line))]';
// Header/footer cell borders and sticky first-column divider are baseline grid affordances in both card and full-view layouts.
// Card layouts should keep bottom padding on the surrounding card content so rounded bottom corners remain visible.
const GRID_HEADER_CELL_BORDERS_CLASS = '[&>tr>th]:shadow-[inset_0_-1px_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line))]';
const GRID_FOOTER_CELL_BORDERS_CLASS = '[&>tr>td]:shadow-[inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]';
const GRID_STICKY_FIRST_COLUMN_DIVIDER_CLASS = 'shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line))]';
const GRID_STICKY_LAST_COLUMN_DIVIDER_CLASS = 'shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line))]';
const GRID_FOOTER_FIRST_COLUMN_STICKY_CLASS = '[&>tr>td:first-child]:sticky [&>tr>td:first-child]:left-0 [&>tr>td:first-child]:z-20 [&>tr>td:first-child]:shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]';
const GRID_FOOTER_LAST_COLUMN_STICKY_CLASS = '[&>tr>td:last-child]:sticky [&>tr>td:last-child]:right-0 [&>tr>td:last-child]:z-20 [&>tr>td:last-child]:shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]';
const GRID_TRAILING_SPACER_COLUMN_WIDTH = 40;
const GRID_TRAILING_SPACER_COLUMN_ID = '__grid_trailing_spacer__';
const PENDING_COMMIT_FOCUS_MAX_ATTEMPTS = 1000;

function scheduleInNextFrame(callback: () => void) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => callback());
    return;
  }
  if (typeof window !== 'undefined') {
    window.setTimeout(callback, 16);
    return;
  }
  callback();
}

/** Spread onto any interactive element to wire it into grid keyboard navigation. */
export function gridNavProps(ctx: DataGridContextValue | null, navCol: number): Record<string, unknown> {
  return {
    'data-row': ctx?.rowIndex,
    'data-row-id': ctx?.rowId,
    'data-col': navCol,
    onKeyDown: ctx?.onCellKeyDown,
    onMouseDown: ctx?.onCellMouseDown,
    onPointerDown: ctx?.onCellPointerDown,
  };
}

/** Use on menu trigger buttons in cells (for example ellipsis actions). */
export function gridMenuTriggerProps(
  ctx: DataGridContextValue | null,
  navCol: number,
): Record<string, unknown> {
  return {
    'data-row': ctx?.rowIndex,
    'data-row-id': ctx?.rowId,
    'data-col': navCol,
    'data-grid-focus-only': 'true',
    onMouseDown: ctx?.onCellMouseDown,
    onPointerDown: ctx?.onCellPointerDown,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (
        event.key === 'Tab' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        ctx?.onCellKeyDown(event);
      }
    },
  };
}

function isGridNavigationKey(key: string) {
  return (
    key === 'Tab'
    || key === 'ArrowUp'
    || key === 'ArrowDown'
    || key === 'ArrowLeft'
    || key === 'ArrowRight'
  );
}

function isGridDeleteResetKey(event: Pick<React.KeyboardEvent<HTMLElement>, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>) {
  return (
    (event.key === 'Backspace' || event.key === 'Delete')
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
  );
}

export function gridSelectTriggerProps(
  ctx: DataGridContextValue | null,
  navCol: number,
  options?: {
    disabled?: boolean;
    onDeleteReset?: () => void | Promise<unknown>;
  },
): Record<string, unknown> {
  return {
    'data-row': ctx?.rowIndex,
    'data-row-id': ctx?.rowId,
    'data-col': navCol,
    onMouseDown: ctx?.onCellMouseDown,
    onPointerDown: ctx?.onCellPointerDown,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (!ctx) return;
      const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
      if (!expanded && !options?.disabled && options?.onDeleteReset && isGridDeleteResetKey(event)) {
        event.preventDefault();
        void options.onDeleteReset();
        return;
      }
      if (!expanded && isGridNavigationKey(event.key)) {
        ctx.onCellKeyDown(event);
      }
    },
  };
}

interface GridNavTarget {
  row: number;
  col: number;
  rowId: string | null;
}

interface StickyViewportInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function rectsOverlap(startA: number, endA: number, startB: number, endB: number) {
  return endA > startB && startA < endB;
}

function getStickyViewportInsets(container: HTMLElement, cell: HTMLElement, cellRect: DOMRect): StickyViewportInsets {
  const containerRect = container.getBoundingClientRect();
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  const stickyRects: DOMRect[] = [];

  for (const stickyElement of container.querySelectorAll<HTMLElement>('.sticky')) {
    if (stickyElement === container || stickyElement.contains(cell)) continue;

    const stickyRect = stickyElement.getBoundingClientRect();
    if (stickyRect.width <= 0 || stickyRect.height <= 0) continue;
    if (!rectsOverlap(stickyRect.left, stickyRect.right, containerRect.left, containerRect.right)) continue;
    if (!rectsOverlap(stickyRect.top, stickyRect.bottom, containerRect.top, containerRect.bottom)) continue;
    stickyRects.push(stickyRect);
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const stickyRect of stickyRects) {
      const overlapsCellHorizontally = rectsOverlap(stickyRect.left, stickyRect.right, cellRect.left, cellRect.right);
      const overlapsCellVertically = rectsOverlap(stickyRect.top, stickyRect.bottom, cellRect.top, cellRect.bottom);
      const spansCellHorizontally = stickyRect.left <= cellRect.left + 1 && stickyRect.right >= cellRect.right - 1;
      const spansCellVertically = stickyRect.top <= cellRect.top + 1 && stickyRect.bottom >= cellRect.bottom - 1;

      if (
        overlapsCellHorizontally &&
        spansCellHorizontally &&
        stickyRect.top <= containerRect.top + top + 1 &&
        stickyRect.bottom > containerRect.top + top
      ) {
        const nextTop = stickyRect.bottom - containerRect.top;
        if (nextTop > top) {
          top = nextTop;
          changed = true;
        }
      }

      if (
        overlapsCellHorizontally &&
        spansCellHorizontally &&
        stickyRect.bottom >= containerRect.bottom - bottom - 1 &&
        stickyRect.top < containerRect.bottom - bottom
      ) {
        const nextBottom = containerRect.bottom - stickyRect.top;
        if (nextBottom > bottom) {
          bottom = nextBottom;
          changed = true;
        }
      }

      if (
        overlapsCellVertically &&
        spansCellVertically &&
        stickyRect.left <= containerRect.left + left + 1 &&
        stickyRect.right > containerRect.left + left
      ) {
        const nextLeft = stickyRect.right - containerRect.left;
        if (nextLeft > left) {
          left = nextLeft;
          changed = true;
        }
      }

      if (
        overlapsCellVertically &&
        spansCellVertically &&
        stickyRect.right >= containerRect.right - right - 1 &&
        stickyRect.left < containerRect.right - right
      ) {
        const nextRight = containerRect.right - stickyRect.left;
        if (nextRight > right) {
          right = nextRight;
          changed = true;
        }
      }
    }
  }

  return { top, right, bottom, left };
}

function focusElementWithoutScroll(target: HTMLElement) {
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
}

// ─── Keyboard Navigation ───
function useGridNav(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onNavigateTarget?: (target: GridNavTarget) => void,
) {
  const pointerInitiatedFocusRef = useRef(false);
  const getEditableCells = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-row][data-col]'));
  }, [containerRef]);

  const scrollCellIntoView = useCallback((cell: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const { top, right, bottom, left } = getStickyViewportInsets(container, cell, cellRect);
    const viewTop = containerRect.top + top;
    const viewRight = containerRect.right - right;
    const viewBottom = containerRect.bottom - bottom;
    const viewLeft = containerRect.left + left;

    if (cellRect.top < viewTop) {
      container.scrollTop += cellRect.top - viewTop;
    } else if (cellRect.bottom > viewBottom) {
      container.scrollTop += cellRect.bottom - viewBottom;
    }

    if (cellRect.left < viewLeft) {
      container.scrollLeft += cellRect.left - viewLeft;
    } else if (cellRect.right > viewRight) {
      container.scrollLeft += cellRect.right - viewRight;
    }
  }, [containerRef]);

  const isCellTemporarilyUnfocusable = useCallback((cell: HTMLElement) => {
    if (cell.hasAttribute('disabled')) return true;
    if (cell.getAttribute('aria-disabled') === 'true') return true;
    return false;
  }, []);

  const getFocusableCells = useCallback(() => {
    return getEditableCells().filter((cell) => !isCellTemporarilyUnfocusable(cell));
  }, [getEditableCells, isCellTemporarilyUnfocusable]);

  const isTargetFocused = useCallback((target: HTMLElement) => {
    const active = document.activeElement;
    return active === target || (active instanceof HTMLElement && target.contains(active));
  }, []);

  const focusCellElement = useCallback((target: HTMLElement) => {
    if (isCellTemporarilyUnfocusable(target)) return false;

    const role = target.getAttribute('role');
    const hasPopup = target.hasAttribute('aria-haspopup');
    if (
      target.tagName === 'BUTTON' &&
      role !== 'checkbox' &&
      role !== 'combobox' &&
      !hasPopup &&
      target.dataset.gridFocusOnly !== 'true'
    ) {
      scheduleInNextFrame(() => scrollCellIntoView(target));
      target.click();
      return true;
    }

    const wasAlreadyFocused = isTargetFocused(target);
    focusElementWithoutScroll(target);
    const focused = isTargetFocused(target);

    if (focused && wasAlreadyFocused) {
      scheduleInNextFrame(() => scrollCellIntoView(target));
    }

    return focused;
  }, [isCellTemporarilyUnfocusable, isTargetFocused, scrollCellIntoView]);

  const focusCell = useCallback((row: number, col: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => Number(el.dataset.row) === row && Number(el.dataset.col) === col);
    if (target) return focusCellElement(target);
    return false;
  }, [focusCellElement, getEditableCells]);

  const focusCellByRowId = useCallback((rowId: string, col: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => el.dataset.rowId === rowId && Number(el.dataset.col) === col);
    if (target) return focusCellElement(target);
    return false;
  }, [focusCellElement, getEditableCells]);

  const getMaxRow = useCallback(() => {
    let max = -1;
    for (const c of getEditableCells()) { const r = Number(c.dataset.row); if (r > max) max = r; }
    return max;
  }, [getEditableCells]);

  const findNextCol = useCallback((row: number, currentCol: number) => {
    const cells = getFocusableCells();
    const cols = cells.filter(c => Number(c.dataset.row) === row).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    return cols.find(c => c > currentCol) ?? null;
  }, [getFocusableCells]);

  const findPrevCol = useCallback((row: number, currentCol: number) => {
    const cells = getFocusableCells();
    const cols = cells.filter(c => Number(c.dataset.row) === row).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    const prev = cols.filter(c => c < currentCol);
    return prev.length > 0 ? prev[prev.length - 1] : null;
  }, [getFocusableCells]);

  const findTargetBeforeSort = useCallback((nextRow: number, nextCol: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => Number(el.dataset.row) === nextRow && Number(el.dataset.col) === nextCol);
    return {
      row: nextRow,
      col: nextCol,
      rowId: target?.dataset.rowId ?? null,
    };
  }, [getEditableCells]);

  const resolveColInRow = useCallback((targetRow: number, preferredCol: number) => {
    const cells = getFocusableCells();
    const cols = cells
      .filter(c => Number(c.dataset.row) === targetRow)
      .map(c => Number(c.dataset.col))
      .sort((a, b) => a - b);

    if (cols.length === 0) return null;
    if (cols.includes(preferredCol)) return preferredCol;

    const lower = cols.filter(c => c < preferredCol);
    if (lower.length > 0) return lower[lower.length - 1];

    const higher = cols.find(c => c > preferredCol);
    return higher ?? null;
  }, [getFocusableCells]);

  const focusWithRetry = useCallback((target: { row: number; col: number; rowId: string | null }, attempts = 120) => {
    let tries = 0;
    const tryFocus = () => {
      const focused =
        (target.rowId ? focusCellByRowId(target.rowId, target.col) : false) ||
        focusCell(target.row, target.col);

      if (focused || tries >= attempts) return;
      tries += 1;
      window.setTimeout(() => scheduleInNextFrame(tryFocus), 24);
    };
    scheduleInNextFrame(tryFocus);
  }, [focusCell, focusCellByRowId]);

  const onCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    if (isNaN(row) || isNaN(col)) return false;

    const target = e.target;
    const isTextInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const isEditing = target instanceof HTMLElement && target.dataset.gridEditing === 'true';

    const moveTo = (nextRow: number, nextCol: number) => {
      const targetBeforeSort = findTargetBeforeSort(nextRow, nextCol);
      onNavigateTarget?.(targetBeforeSort);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      focusWithRetry(targetBeforeSort);
    };

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? findPrevCol(row, col) : findNextCol(row, col);
      if (nextCol === null) return false;
      moveTo(row, nextCol);
      return true;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (isTextInput && isEditing) return false;
      const maxRow = getMaxRow();
      const nextRow = e.key === 'ArrowUp' ? Math.max(0, row - 1) : Math.min(maxRow, row + 1);
      if (nextRow === row) return false;
      const nextCol = resolveColInRow(nextRow, col);
      if (nextCol === null) return false;
      e.preventDefault();
      moveTo(nextRow, nextCol);
      return true;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return false;

      let shouldNavigate = true;
      if (isTextInput) {
        if (!isEditing) {
          shouldNavigate = true;
        } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          if (start !== null && end !== null) {
            const atStart = start === 0 && end === 0;
            const atEnd = start === target.value.length && end === target.value.length;
            shouldNavigate = e.key === 'ArrowLeft' ? atStart : atEnd;
          }
        }
      } else {
        shouldNavigate = true;
      }

      if (!shouldNavigate) return false;

      const nextCol = e.key === 'ArrowLeft' ? findPrevCol(row, col) : findNextCol(row, col);
      if (nextCol === null) return false;
      e.preventDefault();
      moveTo(row, nextCol);
      return true;
    }
    return false;
  }, [findNextCol, findPrevCol, findTargetBeforeSort, focusWithRetry, getMaxRow, onNavigateTarget, resolveColInRow]);

  const onCellMouseDown = useCallback(() => {
    pointerInitiatedFocusRef.current = true;
  }, []);

  const onCellPointerDown = useCallback(() => {
    pointerInitiatedFocusRef.current = true;
  }, []);

  const consumePointerInitiatedFocus = useCallback(() => {
    const wasPointerInitiated = pointerInitiatedFocusRef.current;
    pointerInitiatedFocusRef.current = false;
    return wasPointerInitiated;
  }, []);

  return { onCellKeyDown, onCellMouseDown, onCellPointerDown, scrollCellIntoView, focusCellByRowId, consumePointerInitiatedFocus };
}

// ─── DataGrid ───
interface DataGridProps<TData> {
  table: TanStackTable<TData>;
  footer?: React.ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
  fullView?: boolean;
  stickyFirstColumn?: boolean;
  groupBy?: (row: TData) => string;
  renderGroupHeader?: (groupKey: string, groupRows: Row<TData>[]) => React.ReactNode;
  groupOrder?: (aKey: string, bKey: string) => number;
}

export function DataGrid<TData>({
  table,
  footer,
  emptyMessage = 'No data',
  maxHeight = 'calc(100dvh - 15.5rem)',
  className,
  fullView = false,
  stickyFirstColumn = true,
  groupBy,
  renderGroupHeader,
  groupOrder,
}: DataGridProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const lastCommittedRowIdRef = useRef<string | null>(null);
  const pendingCommitFocusRef = useRef<{ rowId: string; col: number } | null>(null);
  const previousRowPositionsRef = useRef<Map<string, number>>(new Map());
  const previousGroupKeysRef = useRef<Map<string, string | null>>(new Map());
  const clearHighlightTimerRef = useRef<number | null>(null);
  const wasResizingRef = useRef(false);
  const suppressSortClickUntilRef = useRef(0);
  const { onCellKeyDown, onCellMouseDown, onCellPointerDown, scrollCellIntoView, focusCellByRowId, consumePointerInitiatedFocus } = useGridNav(
    containerRef,
    useCallback((target) => {
      if (!target.rowId) return;
      if (lastCommittedRowIdRef.current !== target.rowId) return;
      pendingCommitFocusRef.current = { rowId: target.rowId, col: target.col };
    }, []),
  );
  const rows = table.getRowModel().rows;
  const coreRows = table.getCoreRowModel().rows;
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const actionsColumn = React.useMemo(
    () => visibleLeafColumns.find((column) => column.id === GRID_ACTIONS_COLUMN_ID) ?? null,
    [visibleLeafColumns],
  );
  const hasActionsColumn = actionsColumn != null;
  const hasRowLevelActions = Boolean(actionsColumn?.columnDef.meta?.containsButton);
  const showActionsColumn = hasActionsColumn && hasRowLevelActions;
  const columnSizingState = table.getState().columnSizing;
  const showTrailingSpacerColumn = hasActionsColumn && !showActionsColumn;
  const renderableLeafColumns = React.useMemo(
    () => (showActionsColumn
      ? visibleLeafColumns
      : visibleLeafColumns.filter((column) => column.id !== GRID_ACTIONS_COLUMN_ID)),
    [showActionsColumn, visibleLeafColumns],
  );
  const trailingFillColumnId = React.useMemo(() => {
    // Grid standard: if row-level actions are present, the trailing actions column
    // absorbs all excess table width so content columns do not stretch.
    if (showActionsColumn && hasActionsColumn) return GRID_ACTIONS_COLUMN_ID;
    // When row-level actions are absent, route excess width into the trailing
    // spacer column so content columns keep their explicit widths.
    if (showTrailingSpacerColumn) return GRID_TRAILING_SPACER_COLUMN_ID;
    return renderableLeafColumns.length > 0
      ? renderableLeafColumns[renderableLeafColumns.length - 1]?.id ?? null
      : null;
  }, [hasActionsColumn, renderableLeafColumns, showActionsColumn, showTrailingSpacerColumn]);
  const contentColumnWidth = React.useMemo(
    () => renderableLeafColumns.reduce((sum, column) => sum + column.getSize(), 0),
    [renderableLeafColumns, columnSizingState],
  );
  const totalColumnWidth = contentColumnWidth + (showTrailingSpacerColumn ? GRID_TRAILING_SPACER_COLUMN_WIDTH : 0);
  const isResizingColumn = Boolean(table.getState().columnSizingInfo?.isResizingColumn);
  const liveContainerWidth = containerRef.current?.clientWidth ?? 0;
  const availableTableWidth = Math.max(containerWidth, liveContainerWidth);
  const trailingExtraWidth = trailingFillColumnId
    ? Math.max(0, availableTableWidth - totalColumnWidth)
    : 0;
  const trailingSpacerAppliedWidth = GRID_TRAILING_SPACER_COLUMN_WIDTH + (
    trailingFillColumnId === GRID_TRAILING_SPACER_COLUMN_ID ? trailingExtraWidth : 0
  );
  const tableWidth = totalColumnWidth + trailingExtraWidth;
  const hasFooter = Boolean(footer);
  const isEmptyState = rows.length === 0;
  const bodyClassName = hasFooter
    ? '[&_tr:last-child]:border-0'
    : cn(
        '[&_tr:last-child]:border-0 [&>tr:last-child>td]:shadow-[inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]',
        stickyFirstColumn && !isEmptyState && '[&>tr:last-child>td:first-child]:shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]',
        showActionsColumn && !isEmptyState && '[&>tr:last-child>td:last-child]:shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]',
      );
  const sortableColumns = React.useMemo(
    () => visibleLeafColumns.filter((column) => column.getCanSort()),
    [visibleLeafColumns],
  );
  const alphabeticalColumnIds = React.useMemo(() => {
    if (sortableColumns.length === 0 || coreRows.length === 0) return new Set<string>();
    const ids = new Set<string>();
    const sampleSize = Math.min(coreRows.length, 50);

    for (const column of sortableColumns) {
      for (let idx = 0; idx < sampleSize; idx += 1) {
        const value = coreRows[idx]?.getValue(column.id);
        if (value == null || value === '') continue;
        if (typeof value === 'string' && value.trim().length > 0) ids.add(column.id);
        break;
      }
    }

    return ids;
  }, [coreRows, sortableColumns]);

  const markRowCommitted = useCallback((rowId: string, col: number) => {
    lastCommittedRowIdRef.current = rowId;
    pendingCommitFocusRef.current = { rowId, col };
  }, []);

  const groups = React.useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, Row<TData>[]>();
    const order: string[] = [];
    for (const row of rows) {
      const key = groupBy(row.original);
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(row);
    }
    if (groupOrder) order.sort(groupOrder);
    return { map, order };
  }, [groupBy, groupOrder, rows]);

  const renderedRows = React.useMemo(() => {
    if (groups && renderGroupHeader) {
      return groups.order.flatMap((key) => groups.map.get(key) ?? []);
    }
    return rows;
  }, [groups, renderGroupHeader, rows]);

  const renderedRowIds = React.useMemo(() => renderedRows.map((row) => row.id), [renderedRows]);

  const currentGroupKeys = React.useMemo(() => {
    const keys = new Map<string, string | null>();
    for (const row of rows) {
      keys.set(row.id, groupBy ? groupBy(row.original) : null);
    }
    return keys;
  }, [groupBy, rows]);

  useEffect(() => {
    const nextPositions = new Map<string, number>(renderedRowIds.map((id, idx) => [id, idx]));
    const prevPositions = previousRowPositionsRef.current;
    const prevGroupKeys = previousGroupKeysRef.current;
    const committedRowId = lastCommittedRowIdRef.current;

    if (committedRowId) {
      const previousIndex = prevPositions.get(committedRowId);
      const nextIndex = nextPositions.get(committedRowId);
      const previousGroupKey = prevGroupKeys.get(committedRowId);
      const nextGroupKey = currentGroupKeys.get(committedRowId);
      const movedByPosition = previousIndex != null && nextIndex != null && previousIndex !== nextIndex;
      const movedByGroup = previousGroupKey !== nextGroupKey;

      if (movedByPosition || movedByGroup) {
        setHighlightedRowId(committedRowId);
        if (clearHighlightTimerRef.current != null) window.clearTimeout(clearHighlightTimerRef.current);
        clearHighlightTimerRef.current = window.setTimeout(() => {
          setHighlightedRowId(null);
          clearHighlightTimerRef.current = null;
        }, 3000);
      }
      lastCommittedRowIdRef.current = null;
    }

    previousRowPositionsRef.current = nextPositions;
    previousGroupKeysRef.current = currentGroupKeys;
  }, [currentGroupKeys, renderedRowIds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateContainerWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateContainerWidth);
      return () => window.removeEventListener('resize', updateContainerWidth);
    }

    const resizeObserver = new ResizeObserver(() => updateContainerWidth());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const pending = pendingCommitFocusRef.current;
    if (!pending) return;

    let attempts = 0;
    let cancelled = false;
    let retryTimer: number | null = null;
    const restoreFocus = () => {
      if (cancelled) return;
      if (!containerRef.current) {
        pendingCommitFocusRef.current = null;
        return;
      }
      const focused = focusCellByRowId(pending.rowId, pending.col);
      if (focused) {
        pendingCommitFocusRef.current = null;
        return;
      }
      if (attempts >= PENDING_COMMIT_FOCUS_MAX_ATTEMPTS) {
        pendingCommitFocusRef.current = null;
        return;
      }
      attempts += 1;
      retryTimer = window.setTimeout(() => scheduleInNextFrame(restoreFocus), 24);
    };

    scheduleInNextFrame(restoreFocus);
    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
    };
  }, [currentGroupKeys, focusCellByRowId, renderedRowIds, scrollCellIntoView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.row == null || target.dataset.col == null) return;
      if (consumePointerInitiatedFocus()) return;
      scheduleInNextFrame(() => scrollCellIntoView(target));
    };

    container.addEventListener('focusin', handleFocusIn);
    return () => container.removeEventListener('focusin', handleFocusIn);
  }, [consumePointerInitiatedFocus, scrollCellIntoView]);

  useEffect(() => () => {
    if (clearHighlightTimerRef.current != null) window.clearTimeout(clearHighlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (wasResizingRef.current && !isResizingColumn) {
      suppressSortClickUntilRef.current = performance.now() + 250;
    }
    wasResizingRef.current = isResizingColumn;
  }, [isResizingColumn]);

  let visualRowIdx = 0;

  const renderDataRow = (row: Row<TData>) => {
    const currentRow = visualRowIdx++;
    const cells = showActionsColumn
      ? row.getVisibleCells()
      : row.getVisibleCells().filter((cell) => cell.column.id !== GRID_ACTIONS_COLUMN_ID);
    return (
      <tr
        key={row.id}
        className={cn(
          'group border-b bg-background transition-colors hover:bg-muted',
          highlightedRowId === row.id && 'data-grid-row-resorted',
        )}
      >
        {cells.map((cell, colIdx) => {
          const meta = cell.column.columnDef.meta;
          const isActionsColumn = cell.column.id === GRID_ACTIONS_COLUMN_ID;
          const isStickyActionsColumn = showActionsColumn && isActionsColumn;
          const columnSize = cell.column.getSize();
          const fillsRemainingWidth = cell.column.id === trailingFillColumnId;
          const appliedColumnWidth = columnSize + (fillsRemainingWidth ? trailingExtraWidth : 0);
          const horizontalPaddingClass = isActionsColumn
            ? 'px-0'
            : meta?.containsEditableInput
              ? 'px-1'
              : 'px-2';
          const hasInteractiveControl = isActionsColumn || Boolean(meta?.containsEditableInput || meta?.containsButton);
          const verticalPaddingClass = hasInteractiveControl ? 'py-1' : 'h-9 py-0';
          return (
            <td
              key={cell.id}
              className={cn(
                'align-middle font-normal overflow-hidden',
                horizontalPaddingClass,
                verticalPaddingClass,
                !hasInteractiveControl && GRID_READONLY_TEXT_CLASS,
                colIdx === 0 && stickyFirstColumn && GRID_HEADER_TONE_CLASS,
                colIdx === 0 && stickyFirstColumn && 'sticky left-0 z-20',
                colIdx === 0 && stickyFirstColumn && GRID_STICKY_FIRST_COLUMN_DIVIDER_CLASS,
                isStickyActionsColumn && 'sticky right-0 z-20 bg-inherit',
                isStickyActionsColumn && GRID_STICKY_LAST_COLUMN_DIVIDER_CLASS,
                meta?.cellClassName,
              )}
              style={{
                width: `${appliedColumnWidth}px`,
                minWidth: `${appliedColumnWidth}px`,
                maxWidth: `${appliedColumnWidth}px`,
              }}
            >
              <DataGridCtx.Provider value={{ rowIndex: currentRow, rowId: row.id, onCellKeyDown, onCellMouseDown, onCellPointerDown, onCellCommit: (col) => markRowCommitted(row.id, col) }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </DataGridCtx.Provider>
            </td>
          );
        })}
        {showTrailingSpacerColumn && (
          <td
            className={cn('h-9 px-0 py-0 align-middle font-normal', GRID_READONLY_TEXT_CLASS)}
            style={{
              width: `${trailingSpacerAppliedWidth}px`,
              minWidth: `${trailingSpacerAppliedWidth}px`,
              maxWidth: `${trailingSpacerAppliedWidth}px`,
            }}
          />
        )}
      </tr>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn('w-full min-w-0 overflow-auto data-grid-scroll-hidden', fullView && 'h-full min-h-0', className)}
      style={{ maxHeight: fullView ? 'none' : maxHeight }}
    >
      <table className="min-w-full table-fixed caption-bottom text-xs" style={{ width: `${tableWidth}px` }}>
        <thead className={cn(
          `z-30 ${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS} shadow-[0_1px_0_0_hsl(var(--border))] [&_tr]:border-b-0`,
          GRID_HEADER_CELL_BORDERS_CLASS,
          fullView && 'sticky top-0',
        )}>
          {table.getHeaderGroups().map(hg => {
            const headers = showActionsColumn
              ? hg.headers
              : hg.headers.filter((header) => header.column.id !== GRID_ACTIONS_COLUMN_ID);
            return (
              <tr key={hg.id} className="border-b">
                {headers.map((header, colIdx) => {
                const meta = header.column.columnDef.meta;
                const isActionsColumn = header.column.id === GRID_ACTIONS_COLUMN_ID;
                const isStickyActionsColumn = showActionsColumn && isActionsColumn;
                const sortState = header.column.getIsSorted();
                const isAlphabeticalColumn = alphabeticalColumnIds.has(header.column.id);
                const columnSize = header.getSize();
                const fillsRemainingWidth = header.column.id === trailingFillColumnId;
                const appliedColumnWidth = columnSize + (fillsRemainingWidth ? trailingExtraWidth : 0);
                const canSort = !isActionsColumn && header.column.getCanSort();
                const canResize = !isActionsColumn && header.column.getCanResize();
                const isResizing = header.column.getIsResizing();
                const resizeHandleRight = colIdx === 0 && stickyFirstColumn ? '-4px' : '-5px';
                return (
                  <th
                    key={header.id}
                    className={cn(
                      `relative h-9 text-left align-middle font-medium ${GRID_READONLY_TEXT_CLASS}`,
                      isActionsColumn ? 'px-0' : 'px-2',
                      canSort && 'cursor-pointer select-none',
                      canSort && !isResizingColumn && 'hover:bg-muted',
                      colIdx === 0 && stickyFirstColumn && GRID_HEADER_TONE_CLASS,
                      colIdx === 0 && stickyFirstColumn && `sticky left-0 z-40 bg-border ${GRID_STICKY_FIRST_COLUMN_DIVIDER_CLASS}`,
                      isStickyActionsColumn && `${GRID_HEADER_TONE_CLASS} sticky right-0 z-30`,
                      meta?.headerClassName,
                    )}
                    onClick={(event) => {
                      if (performance.now() < suppressSortClickUntilRef.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      if (!canSort) return;
                      const toggleSorting = header.column.getToggleSortingHandler();
                      toggleSorting?.(event);
                    }}
                    style={{
                      width: `${appliedColumnWidth}px`,
                      minWidth: `${appliedColumnWidth}px`,
                      maxWidth: `${appliedColumnWidth}px`,
                    }}
                  >
                    {isStickyActionsColumn && (
                      <span
                        aria-hidden
                        data-grid-sticky-right-rule="true"
                        className="pointer-events-none absolute left-0 top-1/2 z-10 block h-6 w-px -translate-y-1/2 bg-[hsl(var(--grid-handle-line))]"
                      />
                    )}
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex max-w-full items-center gap-1 overflow-hidden whitespace-nowrap text-ellipsis">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && sortState === 'asc' && (isAlphabeticalColumn
                          ? <ArrowDown className="h-3 w-3" />
                          : <ArrowUp className="h-3 w-3" />)}
                        {canSort && sortState === 'desc' && (isAlphabeticalColumn
                          ? <ArrowUp className="h-3 w-3" />
                          : <ArrowDown className="h-3 w-3" />)}
                      </span>
                    )}
                    {canResize && (
                      <button
                        type="button"
                        aria-label={`Resize ${header.column.id} column`}
                        className={cn(
                          'data-grid-resize-handle group absolute top-1/2 z-30 h-6 w-[10px] -translate-y-1/2 !cursor-col-resize touch-none select-none',
                        )}
                        style={{ right: resizeHandleRight }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          header.getResizeHandler()(event);
                        }}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          header.getResizeHandler()(event);
                        }}
                      >
                        <span
                          className={cn(
                            'pointer-events-none absolute inset-y-0 w-px bg-[hsl(var(--grid-handle-line))] group-hover:bg-foreground',
                            'right-[4px]',
                            isResizing && 'bg-foreground',
                          )}
                        />
                      </button>
                    )}
                  </th>
                );
                })}
                {showTrailingSpacerColumn && (
                  <th
                    className={`h-9 px-0 align-middle font-medium ${GRID_READONLY_TEXT_CLASS}`}
                    style={{
                      width: `${trailingSpacerAppliedWidth}px`,
                      minWidth: `${trailingSpacerAppliedWidth}px`,
                      maxWidth: `${trailingSpacerAppliedWidth}px`,
                    }}
                  />
                )}
              </tr>
            );
          })}
        </thead>
        <tbody className={bodyClassName}>
          {rows.length === 0 ? (
            <tr className="border-b">
              <td colSpan={Math.max(1, renderableLeafColumns.length + (showTrailingSpacerColumn ? 1 : 0))} className={cn('px-1 py-8 text-center', GRID_READONLY_TEXT_CLASS)}>
                {emptyMessage}
              </td>
            </tr>
          ) : groups && renderGroupHeader ? (
            groups.order.map(key => {
              const groupRows = groups.map.get(key)!;
              return (
                <React.Fragment key={`group-${key}`}>
                  {renderGroupHeader(key, groupRows)}
                  {groupRows.map(row => renderDataRow(row))}
                </React.Fragment>
              );
            })
          ) : (
            rows.map(row => renderDataRow(row))
          )}
        </tbody>
        {footer && (
          <tfoot className={cn(
            `${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS} font-medium ${GRID_FOOTER_CELL_BORDERS_CLASS}`,
            stickyFirstColumn && GRID_FOOTER_FIRST_COLUMN_STICKY_CLASS,
            showActionsColumn && GRID_FOOTER_LAST_COLUMN_STICKY_CLASS,
            showTrailingSpacerColumn && '[&>tr>td:last-child]:w-[var(--grid-trailing-spacer-width)] [&>tr>td:last-child]:min-w-[var(--grid-trailing-spacer-width)] [&>tr>td:last-child]:max-w-[var(--grid-trailing-spacer-width)] [&>tr>td:last-child]:px-0',
            fullView && 'sticky bottom-0 z-40',
          )}
          style={showTrailingSpacerColumn
            ? ({ '--grid-trailing-spacer-width': `${trailingSpacerAppliedWidth}px` } as React.CSSProperties)
            : undefined}
          >
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Cell Primitives ───
const CELL_INPUT_CLASS = 'min-w-0 h-7 rounded-md border border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0 !text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

function isPrintableEntryKey(e: React.KeyboardEvent<HTMLInputElement>) {
  return e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;
}

function isNumberEntryKey(e: React.KeyboardEvent<HTMLInputElement>) {
  return isPrintableEntryKey(e) && /^[0-9.-]$/.test(e.key);
}

export type GridNumberDisplayFormat = 'grouped' | 'plain';

export function formatGridNumberDisplay(
  rawValue: string,
  format: GridNumberDisplayFormat = 'grouped',
): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  const normalized = trimmed.replaceAll(',', '');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return rawValue;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return rawValue;

  if (format === 'plain') return normalized;

  return parsed.toLocaleString('en-US', { maximumFractionDigits: 20 });
}

function focusInputAtEnd(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  const end = input.value.length;
  try {
    input.setSelectionRange(end, end);
  } catch {
    // Some input types (for example number in Safari) do not support selection ranges.
  }
}

function setInputCaretAtStart(input: HTMLInputElement | null) {
  if (!input) return;
  input.scrollLeft = 0;
  try {
    input.setSelectionRange(0, 0);
  } catch {
    // Some input types (for example number in Safari) do not support selection ranges.
  }
}

function focusInputAtStart(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  setInputCaretAtStart(input);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && 'then' in value
    && typeof (value as { then?: unknown }).then === 'function'
  );
}

type GridInputValue = string | number | null | undefined;

function normalizeGridInputValue(value: GridInputValue) {
  return value == null ? '' : String(value);
}

export function GridSelectValue({ placeholder = GRID_NULL_PLACEHOLDER, ...props }: React.ComponentProps<typeof SelectValue>) {
  return <SelectValue placeholder={placeholder} {...props} />;
}

export function GridEditableCell({ value, onChange, navCol, type = 'text', inputMode, numberDisplayFormat = 'grouped', className, placeholder, cellId, disabled = false, deleteResetValue, normalizeOnCommit }: {
  value: GridInputValue;
  onChange: (v: string) => void | Promise<unknown>;
  navCol: number;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  numberDisplayFormat?: GridNumberDisplayFormat;
  className?: string;
  placeholder?: string;
  cellId?: string;
  disabled?: boolean;
  deleteResetValue?: string;
  normalizeOnCommit?: (value: string) => string;
}) {
  const ctx = useDataGrid();
  const normalizedValue = normalizeGridInputValue(value);
  const [local, setLocal] = useState(normalizedValue);
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);
  const suppressBlurCommitRef = useRef(false);
  const editStartValueRef = useRef(normalizedValue);
  const valueRef = useRef(normalizedValue);
  const pendingCommittedValueRef = useRef<string | null>(null);
  const commitBaseValueRef = useRef<string | null>(null);
  const awaitingAsyncCommitRef = useRef(false);
  const showFormattedNumber = type === 'number' && !editing;
  const inputType = showFormattedNumber ? 'text' : type;
  const inputValue = showFormattedNumber ? formatGridNumberDisplay(local, numberDisplayFormat) : local;

  useEffect(() => {
    valueRef.current = normalizedValue;
  }, [normalizedValue]);

  useEffect(() => {
    const nextValue = normalizedValue;
    const pendingCommittedValue = pendingCommittedValueRef.current;
    const commitBaseValue = commitBaseValueRef.current;

    if (pendingCommittedValue !== null) {
      if (!awaitingAsyncCommitRef.current && nextValue === pendingCommittedValue) {
        pendingCommittedValueRef.current = null;
        commitBaseValueRef.current = null;
        setLocal(nextValue);
        if (!editing) editStartValueRef.current = nextValue;
        return;
      }
      if (!awaitingAsyncCommitRef.current && commitBaseValue !== null && nextValue !== commitBaseValue) {
        pendingCommittedValueRef.current = null;
        commitBaseValueRef.current = null;
        setLocal(nextValue);
        if (!editing) editStartValueRef.current = nextValue;
        return;
      }
      if (!editing) editStartValueRef.current = pendingCommittedValue;
      return;
    }

    if (!focused || !editing) {
      setLocal(nextValue);
      if (!editing) editStartValueRef.current = nextValue;
    }
  }, [normalizedValue, focused, editing]);

  const commitValue = (nextValue: string) => {
    if (disabled) return;
    const currentValue = normalizedValue;
    const committedValue = normalizeOnCommit ? normalizeOnCommit(nextValue) : nextValue;

    if (committedValue === currentValue) {
      awaitingAsyncCommitRef.current = false;
      pendingCommittedValueRef.current = null;
      commitBaseValueRef.current = null;
      if (nextValue !== currentValue) {
        setLocal(committedValue);
        editStartValueRef.current = committedValue;
      }
      return;
    }

    if (committedValue !== currentValue) {
      setLocal(committedValue);
      pendingCommittedValueRef.current = committedValue;
      commitBaseValueRef.current = currentValue;
      ctx?.onCellCommit(navCol);
      const maybePendingChange = onChange(committedValue);
      if (isPromiseLike(maybePendingChange)) {
        awaitingAsyncCommitRef.current = true;
        void Promise.resolve(maybePendingChange).then(() => {
          awaitingAsyncCommitRef.current = false;
          const pendingValue = pendingCommittedValueRef.current;
          if (pendingValue === null) return;
          const latestValue = valueRef.current;
          const commitBaseValue = commitBaseValueRef.current;
          if (latestValue === pendingValue) {
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            return;
          }
          if (commitBaseValue !== null && latestValue !== commitBaseValue) {
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            setLocal(latestValue);
            editStartValueRef.current = latestValue;
          }
        }).catch(() => {
          awaitingAsyncCommitRef.current = false;
          const rollbackValue = commitBaseValueRef.current ?? valueRef.current;
          pendingCommittedValueRef.current = null;
          commitBaseValueRef.current = null;
          setLocal(rollbackValue);
          editStartValueRef.current = rollbackValue;
        });
      } else {
        awaitingAsyncCommitRef.current = false;
      }
    }
  };

  const commit = () => {
    commitValue(local);
  };

  const handlePressStart = () => {
    pointerDownRef.current = true;
    if (!editing) {
      editStartValueRef.current = local;
      setEditing(true);
    }
  };

  return (
    <Input
      ref={ref}
      type={inputType}
      value={inputValue}
      readOnly={!editing}
      disabled={disabled}
      inputMode={inputMode ?? (type === 'number' ? 'decimal' : undefined)}
      placeholder={placeholder ?? GRID_NULL_PLACEHOLDER}
      data-row={ctx?.rowIndex}
      data-row-id={ctx?.rowId}
      data-col={navCol}
      data-grid-key={cellId}
      data-grid-editing={editing ? 'true' : 'false'}
      onChange={e => { if (editing) setLocal(e.target.value); }}
      onPointerDown={e => {
        if (disabled) return;
        if (e.pointerType === 'mouse') return;
        ctx?.onCellPointerDown();
        handlePressStart();
      }}
      onMouseDown={() => {
        if (disabled) return;
        ctx?.onCellMouseDown();
        handlePressStart();
      }}
      onFocus={() => {
        if (disabled) return;
        setFocused(true);
        if (!pointerDownRef.current) {
          setEditing(false);
          scheduleInNextFrame(() => setInputCaretAtStart(ref.current));
        }
        pointerDownRef.current = false;
      }}
      onBlur={() => {
        if (suppressBlurCommitRef.current) {
          suppressBlurCommitRef.current = false;
        } else if (editing) {
          commit();
        }
        setFocused(false);
        setEditing(false);
        pointerDownRef.current = false;
      }}
        onKeyDown={e => {
          if (disabled) return;
          const startEditingWithKey = (key: string) => {
            if (!editing) {
              editStartValueRef.current = local;
            }
            setEditing(true);
            setLocal(key);
            scheduleInNextFrame(() => focusInputAtEnd(ref.current));
          };

          if (!ctx) {
            if (e.key === 'Enter') {
              if (!editing) {
                e.preventDefault();
                editStartValueRef.current = local;
                setEditing(true);
                scheduleInNextFrame(() => focusInputAtEnd(ref.current));
              } else {
                e.preventDefault();
                commit();
                setEditing(false);
                scheduleInNextFrame(() => focusInputAtStart(ref.current));
              }
              return;
            }
            if (!editing && deleteResetValue !== undefined && isGridDeleteResetKey(e)) {
              e.preventDefault();
              commitValue(deleteResetValue);
              scheduleInNextFrame(() => focusInputAtStart(ref.current));
              return;
            }
            if (!editing && (type === 'number' ? isNumberEntryKey(e) : isPrintableEntryKey(e))) {
              e.preventDefault();
              startEditingWithKey(e.key);
            }
            return;
          }

          if (!editing) {
            if (e.key === 'Enter') {
              e.preventDefault();
              editStartValueRef.current = local;
              setEditing(true);
              scheduleInNextFrame(() => focusInputAtEnd(ref.current));
              return;
            }
            if (deleteResetValue !== undefined && isGridDeleteResetKey(e)) {
              e.preventDefault();
              commitValue(deleteResetValue);
              scheduleInNextFrame(() => focusInputAtStart(ref.current));
              return;
            }
            if (type === 'number' ? isNumberEntryKey(e) : isPrintableEntryKey(e)) {
              e.preventDefault();
              startEditingWithKey(e.key);
              return;
            }
            ctx.onCellKeyDown(e);
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          setEditing(false);
          scheduleInNextFrame(() => focusInputAtStart(ref.current));
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          awaitingAsyncCommitRef.current = false;
          pendingCommittedValueRef.current = null;
          commitBaseValueRef.current = null;
          setLocal(editStartValueRef.current);
          setEditing(false);
          scheduleInNextFrame(() => focusInputAtStart(ref.current));
          return;
        }

        if (e.key === 'Tab') {
          suppressBlurCommitRef.current = true;
          commit();
          const moved = ctx.onCellKeyDown(e);
          if (!moved) suppressBlurCommitRef.current = false;
        }
      }}
      className={cn(CELL_INPUT_CLASS, !editing && 'caret-transparent', 'disabled:opacity-60 disabled:cursor-not-allowed', className)}
    />
  );
}

export function GridCurrencyCell({ value, onChange, navCol, className, disabled = false, deleteResetValue, placeholder }: {
  value: GridInputValue;
  onChange: (v: string) => void | Promise<unknown>;
  navCol: number;
  className?: string;
  disabled?: boolean;
  deleteResetValue?: string;
  placeholder?: string;
}) {
  const ctx = useDataGrid();
  const normalizedValue = normalizeGridInputValue(value);
  const [local, setLocal] = useState(normalizedValue);
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);
  const suppressBlurCommitRef = useRef(false);
  const editStartValueRef = useRef(normalizedValue);
  const valueRef = useRef(normalizedValue);
  const pendingCommittedValueRef = useRef<string | null>(null);
  const commitBaseValueRef = useRef<string | null>(null);
  const awaitingAsyncCommitRef = useRef(false);

  useEffect(() => {
    valueRef.current = normalizedValue;
  }, [normalizedValue]);

  useEffect(() => {
    const nextValue = normalizedValue;
    const pendingCommittedValue = pendingCommittedValueRef.current;
    const commitBaseValue = commitBaseValueRef.current;

    if (pendingCommittedValue !== null) {
      if (!awaitingAsyncCommitRef.current && nextValue === pendingCommittedValue) {
        pendingCommittedValueRef.current = null;
        commitBaseValueRef.current = null;
        setLocal(nextValue);
        if (!editing) editStartValueRef.current = nextValue;
        return;
      }
      if (!awaitingAsyncCommitRef.current && commitBaseValue !== null && nextValue !== commitBaseValue) {
        pendingCommittedValueRef.current = null;
        commitBaseValueRef.current = null;
        setLocal(nextValue);
        if (!editing) editStartValueRef.current = nextValue;
        return;
      }
      if (!editing) editStartValueRef.current = pendingCommittedValue;
      return;
    }

    if (!focused || !editing) {
      setLocal(nextValue);
      if (!editing) editStartValueRef.current = nextValue;
    }
  }, [normalizedValue, focused, editing]);

  const commitValue = (nextValue: string) => {
    if (disabled) return;
    const currentValue = normalizedValue;
    if (nextValue !== currentValue) {
      setLocal(nextValue);
      pendingCommittedValueRef.current = nextValue;
      commitBaseValueRef.current = currentValue;
      ctx?.onCellCommit(navCol);
      const maybePendingChange = onChange(nextValue);
      if (isPromiseLike(maybePendingChange)) {
        awaitingAsyncCommitRef.current = true;
        void Promise.resolve(maybePendingChange).then(() => {
          awaitingAsyncCommitRef.current = false;
          const pendingValue = pendingCommittedValueRef.current;
          if (pendingValue === null) return;
          const latestValue = valueRef.current;
          const commitBaseValue = commitBaseValueRef.current;
          if (latestValue === pendingValue) {
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            return;
          }
          if (commitBaseValue !== null && latestValue !== commitBaseValue) {
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            setLocal(latestValue);
            editStartValueRef.current = latestValue;
          }
        }).catch(() => {
          awaitingAsyncCommitRef.current = false;
          const rollbackValue = commitBaseValueRef.current ?? valueRef.current;
          pendingCommittedValueRef.current = null;
          commitBaseValueRef.current = null;
          setLocal(rollbackValue);
          editStartValueRef.current = rollbackValue;
        });
      } else {
        awaitingAsyncCommitRef.current = false;
      }
    }
  };

  const commit = () => {
    commitValue(local);
  };

  const handlePressStart = () => {
    pointerDownRef.current = true;
    if (!editing) {
      editStartValueRef.current = local;
      setEditing(true);
    }
  };

  return (
    <div className="relative w-full min-w-[60px]">
      <span className={cn('pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 !text-xs font-normal', GRID_READONLY_TEXT_CLASS)}>$</span>
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={local}
        readOnly={!editing}
        disabled={disabled}
        placeholder={placeholder ?? GRID_NULL_PLACEHOLDER}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={navCol}
        data-grid-editing={editing ? 'true' : 'false'}
        onChange={e => { if (editing) setLocal(e.target.value); }}
        onPointerDown={e => {
          if (disabled) return;
          if (e.pointerType === 'mouse') return;
          ctx?.onCellPointerDown();
          handlePressStart();
        }}
        onMouseDown={() => {
          if (disabled) return;
          ctx?.onCellMouseDown();
          handlePressStart();
        }}
        onFocus={() => {
          if (disabled) return;
          setFocused(true);
          if (pointerDownRef.current) {
            pointerDownRef.current = false;
            if (!editing) {
              editStartValueRef.current = local;
              setEditing(true);
            }
            return;
          }
          setEditing(false);
          scheduleInNextFrame(() => setInputCaretAtStart(ref.current));
          pointerDownRef.current = false;
        }}
        onBlur={() => {
          if (suppressBlurCommitRef.current) {
            suppressBlurCommitRef.current = false;
          } else if (editing) {
            commit();
          }
          setFocused(false);
          setEditing(false);
          pointerDownRef.current = false;
        }}
        onKeyDown={e => {
          if (disabled) return;
          const startEditingWithKey = (key: string) => {
            if (!editing) {
              editStartValueRef.current = local;
            }
            setEditing(true);
            setLocal(key);
            scheduleInNextFrame(() => focusInputAtEnd(ref.current));
          };

          if (!ctx) {
            if (e.key === 'Enter') {
              if (!editing) {
                e.preventDefault();
                editStartValueRef.current = local;
                setEditing(true);
                scheduleInNextFrame(() => focusInputAtEnd(ref.current));
              } else {
                e.preventDefault();
                commit();
                setEditing(false);
                scheduleInNextFrame(() => focusInputAtStart(ref.current));
              }
              return;
            }
            if (!editing && deleteResetValue !== undefined && isGridDeleteResetKey(e)) {
              e.preventDefault();
              commitValue(deleteResetValue);
              scheduleInNextFrame(() => focusInputAtStart(ref.current));
              return;
            }
            if (!editing && isNumberEntryKey(e)) {
              e.preventDefault();
              startEditingWithKey(e.key);
            }
            return;
          }

          if (!editing) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              editStartValueRef.current = local;
              setEditing(true);
              scheduleInNextFrame(() => {
                if (e.key === 'Enter') {
                  focusInputAtEnd(ref.current);
                } else {
                  focusInputAtStart(ref.current);
                }
              });
              return;
            }
            if (deleteResetValue !== undefined && isGridDeleteResetKey(e)) {
              e.preventDefault();
              commitValue(deleteResetValue);
              scheduleInNextFrame(() => focusInputAtStart(ref.current));
              return;
            }
            if (isNumberEntryKey(e)) {
              e.preventDefault();
              startEditingWithKey(e.key);
              return;
            }
            ctx.onCellKeyDown(e);
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            setEditing(false);
            scheduleInNextFrame(() => focusInputAtStart(ref.current));
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            awaitingAsyncCommitRef.current = false;
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            setLocal(editStartValueRef.current);
            setEditing(false);
            scheduleInNextFrame(() => focusInputAtStart(ref.current));
            return;
          }

          if (e.key === 'Tab') {
            suppressBlurCommitRef.current = true;
            commit();
            const moved = ctx.onCellKeyDown(e);
            if (!moved) suppressBlurCommitRef.current = false;
          }
        }}
        className={cn(CELL_INPUT_CLASS, '!w-full pl-4 pr-2 !text-right', !editing && 'caret-transparent', 'disabled:opacity-60 disabled:cursor-not-allowed', className)}
      />
    </div>
  );
}

export function GridPercentCell({ value, onChange, navCol, className, disabled = false, deleteResetValue, placeholder }: {
  value: GridInputValue;
  onChange: (v: string) => void | Promise<unknown>;
  navCol: number;
  className?: string;
  disabled?: boolean;
  deleteResetValue?: string;
  placeholder?: string;
}) {
  const ctx = useDataGrid();
  const normalizedValue = normalizeGridInputValue(value);
  const [local, setLocal] = useState(normalizedValue);
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);
  const suppressBlurCommitRef = useRef(false);
  const editStartValueRef = useRef(normalizedValue);
  const valueRef = useRef(normalizedValue);
  const pendingCommittedValueRef = useRef<string | null>(null);
  const commitBaseValueRef = useRef<string | null>(null);
  const awaitingAsyncCommitRef = useRef(false);

  useEffect(() => {
    valueRef.current = normalizedValue;
  }, [normalizedValue]);

  useEffect(() => {
    const nextValue = normalizedValue;
    const pendingCommittedValue = pendingCommittedValueRef.current;
    const commitBaseValue = commitBaseValueRef.current;

    if (pendingCommittedValue !== null) {
      if (!awaitingAsyncCommitRef.current && nextValue === pendingCommittedValue) {
        pendingCommittedValueRef.current = null;
        commitBaseValueRef.current = null;
        setLocal(nextValue);
        if (!editing) editStartValueRef.current = nextValue;
        return;
      }
      if (!awaitingAsyncCommitRef.current && commitBaseValue !== null && nextValue !== commitBaseValue) {
        pendingCommittedValueRef.current = null;
        commitBaseValueRef.current = null;
        setLocal(nextValue);
        if (!editing) editStartValueRef.current = nextValue;
        return;
      }
      if (!editing) editStartValueRef.current = pendingCommittedValue;
      return;
    }

    if (!focused || !editing) {
      setLocal(nextValue);
      if (!editing) editStartValueRef.current = nextValue;
    }
  }, [normalizedValue, focused, editing]);

  const commitValue = (nextValue: string) => {
    if (disabled) return;
    const currentValue = normalizedValue;
    if (nextValue !== currentValue) {
      setLocal(nextValue);
      pendingCommittedValueRef.current = nextValue;
      commitBaseValueRef.current = currentValue;
      ctx?.onCellCommit(navCol);
      const maybePendingChange = onChange(nextValue);
      if (isPromiseLike(maybePendingChange)) {
        awaitingAsyncCommitRef.current = true;
        void Promise.resolve(maybePendingChange).then(() => {
          awaitingAsyncCommitRef.current = false;
          const pendingValue = pendingCommittedValueRef.current;
          if (pendingValue === null) return;
          const latestValue = valueRef.current;
          const commitBaseValue = commitBaseValueRef.current;
          if (latestValue === pendingValue) {
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            return;
          }
          if (commitBaseValue !== null && latestValue !== commitBaseValue) {
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            setLocal(latestValue);
            editStartValueRef.current = latestValue;
          }
        }).catch(() => {
          awaitingAsyncCommitRef.current = false;
          const rollbackValue = commitBaseValueRef.current ?? valueRef.current;
          pendingCommittedValueRef.current = null;
          commitBaseValueRef.current = null;
          setLocal(rollbackValue);
          editStartValueRef.current = rollbackValue;
        });
      } else {
        awaitingAsyncCommitRef.current = false;
      }
    }
  };

  const commit = () => {
    commitValue(local);
  };

  const handlePressStart = () => {
    pointerDownRef.current = true;
    if (!editing) {
      editStartValueRef.current = local;
      setEditing(true);
    }
  };

  return (
    <div className="relative w-full min-w-[60px]">
      <span className={cn('pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 !text-xs font-normal', GRID_READONLY_TEXT_CLASS)}>%</span>
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        value={local}
        min={0}
        max={100}
        readOnly={!editing}
        disabled={disabled}
        placeholder={placeholder ?? GRID_NULL_PLACEHOLDER}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={navCol}
        data-grid-editing={editing ? 'true' : 'false'}
        onChange={e => { if (editing) setLocal(e.target.value); }}
        onPointerDown={e => {
          if (disabled) return;
          if (e.pointerType === 'mouse') return;
          ctx?.onCellPointerDown();
          handlePressStart();
        }}
        onMouseDown={() => {
          if (disabled) return;
          ctx?.onCellMouseDown();
          handlePressStart();
        }}
        onFocus={() => {
          if (disabled) return;
          setFocused(true);
          if (!pointerDownRef.current) {
            setEditing(false);
            scheduleInNextFrame(() => setInputCaretAtStart(ref.current));
          }
          pointerDownRef.current = false;
        }}
        onBlur={() => {
          if (suppressBlurCommitRef.current) {
            suppressBlurCommitRef.current = false;
          } else if (editing) {
            commit();
          }
          setFocused(false);
          setEditing(false);
          pointerDownRef.current = false;
        }}
        onKeyDown={e => {
          if (disabled) return;
          const startEditingWithKey = (key: string) => {
            if (!editing) {
              editStartValueRef.current = local;
            }
            setEditing(true);
            setLocal(key);
            scheduleInNextFrame(() => focusInputAtEnd(ref.current));
          };

          if (!ctx) {
            if (e.key === 'Enter') {
              if (!editing) {
                e.preventDefault();
                editStartValueRef.current = local;
                setEditing(true);
                scheduleInNextFrame(() => focusInputAtEnd(ref.current));
              } else {
                e.preventDefault();
                commit();
                setEditing(false);
                scheduleInNextFrame(() => focusInputAtStart(ref.current));
              }
              return;
            }
            if (!editing && deleteResetValue !== undefined && isGridDeleteResetKey(e)) {
              e.preventDefault();
              commitValue(deleteResetValue);
              scheduleInNextFrame(() => focusInputAtStart(ref.current));
              return;
            }
            if (!editing && isNumberEntryKey(e)) {
              e.preventDefault();
              startEditingWithKey(e.key);
            }
            return;
          }

          if (!editing) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              editStartValueRef.current = local;
              setEditing(true);
              scheduleInNextFrame(() => {
                if (e.key === 'Enter') {
                  focusInputAtEnd(ref.current);
                } else {
                  focusInputAtStart(ref.current);
                }
              });
              return;
            }
            if (deleteResetValue !== undefined && isGridDeleteResetKey(e)) {
              e.preventDefault();
              commitValue(deleteResetValue);
              scheduleInNextFrame(() => focusInputAtStart(ref.current));
              return;
            }
            if (isNumberEntryKey(e)) {
              e.preventDefault();
              startEditingWithKey(e.key);
              return;
            }
            ctx.onCellKeyDown(e);
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            setEditing(false);
            scheduleInNextFrame(() => focusInputAtStart(ref.current));
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            awaitingAsyncCommitRef.current = false;
            pendingCommittedValueRef.current = null;
            commitBaseValueRef.current = null;
            setLocal(editStartValueRef.current);
            setEditing(false);
            scheduleInNextFrame(() => focusInputAtStart(ref.current));
            return;
          }

          if (e.key === 'Tab') {
            suppressBlurCommitRef.current = true;
            commit();
            const moved = ctx.onCellKeyDown(e);
            if (!moved) suppressBlurCommitRef.current = false;
          }
        }}
        className={cn(CELL_INPUT_CLASS, '!w-full pr-6 !text-right', !editing && 'caret-transparent', 'disabled:opacity-60 disabled:cursor-not-allowed', className)}
      />
    </div>
  );
}

export function GridCheckboxCell({ checked, onChange, navCol, className, disabled = false, deleteResetChecked }: {
  checked: boolean;
  onChange: (next: boolean) => void | Promise<unknown>;
  navCol: number;
  className?: string;
  disabled?: boolean;
  deleteResetChecked?: boolean;
}) {
  const ctx = useDataGrid();
  const [localChecked, setLocalChecked] = useState(checked);
  const checkedRef = useRef(checked);
  const pendingCommittedCheckedRef = useRef<boolean | null>(null);
  const commitBaseCheckedRef = useRef<boolean | null>(null);
  const awaitingAsyncCommitRef = useRef(false);

  useEffect(() => {
    checkedRef.current = checked;
  }, [checked]);

  useEffect(() => {
    const pendingCommittedChecked = pendingCommittedCheckedRef.current;
    const commitBaseChecked = commitBaseCheckedRef.current;

    if (pendingCommittedChecked !== null) {
      if (!awaitingAsyncCommitRef.current && checked === pendingCommittedChecked) {
        pendingCommittedCheckedRef.current = null;
        commitBaseCheckedRef.current = null;
        setLocalChecked(checked);
        return;
      }
      if (!awaitingAsyncCommitRef.current && commitBaseChecked !== null && checked !== commitBaseChecked) {
        pendingCommittedCheckedRef.current = null;
        commitBaseCheckedRef.current = null;
        setLocalChecked(checked);
        return;
      }
      setLocalChecked(pendingCommittedChecked);
      return;
    }

    setLocalChecked(checked);
  }, [checked]);

  const commit = (next: boolean) => {
    if (disabled) return;
    const currentChecked = checked;
    if (next === currentChecked && pendingCommittedCheckedRef.current === null) return;

    pendingCommittedCheckedRef.current = next;
    commitBaseCheckedRef.current = currentChecked;
    setLocalChecked(next);
    ctx?.onCellCommit(navCol);

    const maybePendingChange = onChange(next);
    if (isPromiseLike(maybePendingChange)) {
      awaitingAsyncCommitRef.current = true;
      void Promise.resolve(maybePendingChange).then(() => {
        awaitingAsyncCommitRef.current = false;
        const pendingChecked = pendingCommittedCheckedRef.current;
        if (pendingChecked === null) return;
        const latestChecked = checkedRef.current;
        const commitBaseChecked = commitBaseCheckedRef.current;
        if (latestChecked === pendingChecked) {
          pendingCommittedCheckedRef.current = null;
          commitBaseCheckedRef.current = null;
          return;
        }
        if (commitBaseChecked !== null && latestChecked !== commitBaseChecked) {
          pendingCommittedCheckedRef.current = null;
          commitBaseCheckedRef.current = null;
          setLocalChecked(latestChecked);
        }
      }).catch(() => {
        awaitingAsyncCommitRef.current = false;
        const rollbackChecked = commitBaseCheckedRef.current ?? checkedRef.current;
        pendingCommittedCheckedRef.current = null;
        commitBaseCheckedRef.current = null;
        setLocalChecked(rollbackChecked);
      });
    } else {
      awaitingAsyncCommitRef.current = false;
    }
  };

  return (
    <Checkbox
      checked={localChecked}
      disabled={disabled}
      data-row={ctx?.rowIndex}
      data-row-id={ctx?.rowId}
      data-col={navCol}
      onMouseDown={ctx?.onCellMouseDown}
      onCheckedChange={(next) => {
        commit(next === true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          commit(!localChecked);
          return;
        }
        if (deleteResetChecked !== undefined && isGridDeleteResetKey(event)) {
          event.preventDefault();
          commit(deleteResetChecked);
          return;
        }
        ctx?.onCellKeyDown(event);
      }}
      className={className}
    />
  );
}
