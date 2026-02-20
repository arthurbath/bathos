import * as React from 'react';
import { useState, useRef, useCallback, useContext, createContext, useEffect } from 'react';
import {
  flexRender,
  type Table as TanStackTable,
  type Row,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Column Meta Augmentation ───
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

// ─── Context ───
interface DataGridContextValue {
  rowIndex: number;
  rowId: string;
  onCellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => boolean;
  onCellMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  onCellCommit: (col: number) => void;
}

const DataGridCtx = createContext<DataGridContextValue | null>(null);
export function useDataGrid() { return useContext(DataGridCtx); }

export const GRID_HEADER_TONE_CLASS = 'bg-border';
export const GRID_READONLY_TEXT_CLASS = 'text-muted-foreground';

/** Spread onto any interactive element to wire it into grid keyboard navigation. */
export function gridNavProps(ctx: DataGridContextValue | null, navCol: number): Record<string, unknown> {
  return {
    'data-row': ctx?.rowIndex,
    'data-row-id': ctx?.rowId,
    'data-col': navCol,
    onKeyDown: ctx?.onCellKeyDown,
    onMouseDown: ctx?.onCellMouseDown,
  };
}

interface GridNavTarget {
  row: number;
  col: number;
  rowId: string | null;
}

// ─── Keyboard Navigation ───
function useGridNav(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onNavigateTarget?: (target: GridNavTarget) => void,
) {
  const getEditableCells = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-row][data-col]'));
  }, [containerRef]);

  const scrollCellIntoView = useCallback((cell: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const stickyHeader = container.querySelector<HTMLElement>('thead.sticky');
    const stickyFooter = container.querySelector<HTMLElement>('tfoot.sticky');
    const headerHeight = stickyHeader?.getBoundingClientRect().height ?? 0;
    const footerHeight = stickyFooter?.getBoundingClientRect().height ?? 0;
    const viewTop = containerRect.top + headerHeight;
    const viewBottom = containerRect.bottom - footerHeight;

    if (cellRect.top < viewTop) {
      container.scrollTop += cellRect.top - viewTop;
    } else if (cellRect.bottom > viewBottom) {
      container.scrollTop += cellRect.bottom - viewBottom;
    }

    if (cellRect.left < containerRect.left) {
      container.scrollLeft += cellRect.left - containerRect.left;
    } else if (cellRect.right > containerRect.right) {
      container.scrollLeft += cellRect.right - containerRect.right;
    }
  }, [containerRef]);

  const focusCell = useCallback((row: number, col: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => Number(el.dataset.row) === row && Number(el.dataset.col) === col);
    if (target) {
      const role = target.getAttribute('role');
      if (target.tagName === 'BUTTON' && role !== 'checkbox' && role !== 'combobox') target.click();
      else target.focus();
      requestAnimationFrame(() => scrollCellIntoView(target));
      return true;
    }
    return false;
  }, [getEditableCells, scrollCellIntoView]);

  const focusCellByRowId = useCallback((rowId: string, col: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => el.dataset.rowId === rowId && Number(el.dataset.col) === col);
    if (target) {
      const role = target.getAttribute('role');
      if (target.tagName === 'BUTTON' && role !== 'checkbox' && role !== 'combobox') target.click();
      else target.focus();
      requestAnimationFrame(() => scrollCellIntoView(target));
      return true;
    }
    return false;
  }, [getEditableCells, scrollCellIntoView]);

  const getMaxRow = useCallback(() => {
    let max = -1;
    for (const c of getEditableCells()) { const r = Number(c.dataset.row); if (r > max) max = r; }
    return max;
  }, [getEditableCells]);

  const findNextCol = useCallback((row: number, currentCol: number) => {
    const cells = getEditableCells();
    const cols = cells.filter(c => Number(c.dataset.row) === row).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    return cols.find(c => c > currentCol) ?? null;
  }, [getEditableCells]);

  const findPrevCol = useCallback((row: number, currentCol: number) => {
    const cells = getEditableCells();
    const cols = cells.filter(c => Number(c.dataset.row) === row).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    const prev = cols.filter(c => c < currentCol);
    return prev.length > 0 ? prev[prev.length - 1] : null;
  }, [getEditableCells]);

  const findTargetBeforeSort = useCallback((nextRow: number, nextCol: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => Number(el.dataset.row) === nextRow && Number(el.dataset.col) === nextCol);
    return {
      row: nextRow,
      col: nextCol,
      rowId: target?.dataset.rowId ?? null,
    };
  }, [getEditableCells]);

  const focusWithRetry = useCallback((target: { row: number; col: number; rowId: string | null }, attempts = 10) => {
    let tries = 0;
    const tryFocus = () => {
      const focused =
        (target.rowId ? focusCellByRowId(target.rowId, target.col) : false) ||
        focusCell(target.row, target.col);

      if (focused || tries >= attempts) return;
      tries += 1;
      window.setTimeout(() => requestAnimationFrame(tryFocus), 24);
    };
    requestAnimationFrame(tryFocus);
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
      e.preventDefault();
      moveTo(nextRow, col);
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
  }, [findNextCol, findPrevCol, findTargetBeforeSort, focusWithRetry, getMaxRow, onNavigateTarget]);

  const onCellMouseDown = useCallback((_e: React.MouseEvent<HTMLElement>) => {}, []);

  return { onCellKeyDown, onCellMouseDown, scrollCellIntoView, focusCellByRowId };
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
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const lastCommittedRowIdRef = useRef<string | null>(null);
  const pendingCommitFocusRef = useRef<{ rowId: string; col: number } | null>(null);
  const previousRowPositionsRef = useRef<Map<string, number>>(new Map());
  const previousGroupKeysRef = useRef<Map<string, string | null>>(new Map());
  const clearHighlightTimerRef = useRef<number | null>(null);
  const { onCellKeyDown, onCellMouseDown, scrollCellIntoView, focusCellByRowId } = useGridNav(
    containerRef,
    useCallback((target) => {
      if (!target.rowId) return;
      if (lastCommittedRowIdRef.current !== target.rowId) return;
      pendingCommitFocusRef.current = { rowId: target.rowId, col: target.col };
    }, []),
  );
  const rows = table.getRowModel().rows;
  const coreRows = table.getCoreRowModel().rows;
  const alphabeticalColumnIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const row of coreRows) {
      for (const cell of row.getAllCells()) {
        const value = cell.getValue();
        if (typeof value === 'string' && value.trim().length > 0) {
          ids.add(cell.column.id);
        }
      }
    }
    return ids;
  }, [coreRows]);

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
    const pending = pendingCommitFocusRef.current;
    if (!pending) return;

    const active = document.activeElement;
    const container = containerRef.current;
    const activeInGridCell =
      active instanceof HTMLElement &&
      !!container &&
      container.contains(active) &&
      active.dataset.row != null &&
      active.dataset.col != null;

    if (activeInGridCell) {
      const activeEl = active as HTMLElement;
      const activeRowId = activeEl.dataset.rowId ?? null;
      const activeCol = Number(activeEl.dataset.col);
      const activeIsPendingTarget =
        activeRowId === pending.rowId &&
        !Number.isNaN(activeCol) &&
        activeCol === pending.col;

      if (activeIsPendingTarget) {
        requestAnimationFrame(() => scrollCellIntoView(activeEl));
        pendingCommitFocusRef.current = null;
        return;
      }

      const activeOnDifferentRow = activeRowId !== pending.rowId;
      if (activeOnDifferentRow) {
        pendingCommitFocusRef.current = null;
        return;
      }
    }

    let attempts = 0;
    const restoreFocus = () => {
      const focused = focusCellByRowId(pending.rowId, pending.col);
      if (focused) {
        pendingCommitFocusRef.current = null;
        return;
      }
      if (attempts >= 10) {
        pendingCommitFocusRef.current = null;
        return;
      }
      attempts += 1;
      window.setTimeout(() => requestAnimationFrame(restoreFocus), 24);
    };

    requestAnimationFrame(restoreFocus);
  }, [focusCellByRowId, renderedRowIds, scrollCellIntoView]);

  useEffect(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!containerRef.current?.contains(active)) return;
    if (active.dataset.row == null || active.dataset.col == null) return;
    requestAnimationFrame(() => scrollCellIntoView(active));
  }, [renderedRowIds, scrollCellIntoView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.row == null || target.dataset.col == null) return;
      requestAnimationFrame(() => scrollCellIntoView(target));
    };

    container.addEventListener('focusin', handleFocusIn);
    return () => container.removeEventListener('focusin', handleFocusIn);
  }, [scrollCellIntoView]);

  useEffect(() => () => {
    if (clearHighlightTimerRef.current != null) window.clearTimeout(clearHighlightTimerRef.current);
  }, []);

  let visualRowIdx = 0;

  const renderDataRow = (row: Row<TData>) => {
    const currentRow = visualRowIdx++;
    return (
      <tr
        key={row.id}
        className={cn(
          'border-b transition-colors hover:bg-muted/50',
          highlightedRowId === row.id && 'data-grid-row-resorted',
        )}
      >
        {row.getVisibleCells().map((cell, colIdx) => {
          const meta = cell.column.columnDef.meta;
          return (
            <td
              key={cell.id}
              className={cn(
                'px-1 py-1 align-middle font-normal',
                colIdx === 0 && stickyFirstColumn && GRID_HEADER_TONE_CLASS,
                colIdx === 0 && stickyFirstColumn && fullView && 'sticky left-0 z-10',
                meta?.cellClassName,
              )}
            >
              <DataGridCtx.Provider value={{ rowIndex: currentRow, rowId: row.id, onCellKeyDown, onCellMouseDown, onCellCommit: (col) => markRowCommitted(row.id, col) }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </DataGridCtx.Provider>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', fullView && 'h-full min-h-0', className)}
      style={{ maxHeight: fullView ? 'none' : maxHeight }}
    >
      <table className="w-full caption-bottom text-xs">
        <thead className={cn(
          `z-30 ${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS} shadow-[0_1px_0_0_hsl(var(--border))] [&_tr]:border-b-0`,
          fullView && 'sticky top-0',
        )}>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="border-b transition-colors">
              {hg.headers.map((header, colIdx) => {
                const meta = header.column.columnDef.meta;
                const sortState = header.column.getIsSorted();
                const isAlphabeticalColumn = alphabeticalColumnIds.has(header.column.id);
                return (
                  <th
                    key={header.id}
                    className={cn(
                      `h-9 px-2 text-left align-middle font-medium ${GRID_READONLY_TEXT_CLASS}`,
                      header.column.getCanSort() && 'cursor-pointer select-none hover:bg-muted/50',
                      colIdx === 0 && stickyFirstColumn && GRID_HEADER_TONE_CLASS,
                      colIdx === 0 && stickyFirstColumn && fullView && 'sticky left-0 z-40',
                      meta?.headerClassName,
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && sortState === 'asc' && (isAlphabeticalColumn
                          ? <ArrowDown className="h-3 w-3" />
                          : <ArrowUp className="h-3 w-3" />)}
                        {header.column.getCanSort() && sortState === 'desc' && (isAlphabeticalColumn
                          ? <ArrowUp className="h-3 w-3" />
                          : <ArrowDown className="h-3 w-3" />)}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {rows.length === 0 ? (
            <tr className="border-b">
              <td colSpan={table.getAllColumns().length} className="px-1 py-8 text-center text-muted-foreground">
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
            `border-t ${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS} font-medium [&>tr]:last:border-b-0`,
            fullView && 'sticky bottom-0 z-30',
          )}>
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Cell Primitives ───
const CELL_INPUT_CLASS = 'h-7 rounded-md border border-transparent bg-transparent px-1 hover:border-foreground/35 focus:border-transparent focus:ring-2 focus:ring-ring !text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const STICKY_COL_INPUT_HOVER_CLASS = 'hover:border-foreground/50';

function isPrintableEntryKey(e: React.KeyboardEvent<HTMLInputElement>) {
  return e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;
}

function isNumberEntryKey(e: React.KeyboardEvent<HTMLInputElement>) {
  return isPrintableEntryKey(e) && /^[0-9.-]$/.test(e.key);
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

export function GridEditableCell({ value, onChange, navCol, type = 'text', className, placeholder, cellId }: {
  value: string | number;
  onChange: (v: string) => void;
  navCol: number;
  type?: string;
  className?: string;
  placeholder?: string;
  cellId?: string;
}) {
  const ctx = useDataGrid();
  const [local, setLocal] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);
  const suppressBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!focused || !editing) setLocal(String(value));
  }, [value, focused, editing]);

  const commit = () => {
    if (local !== String(value)) {
      ctx?.onCellCommit(navCol);
      onChange(local);
    }
  };

  return (
    <Input
      ref={ref}
      type={type}
      value={local}
      readOnly={!editing}
      placeholder={placeholder}
      data-row={ctx?.rowIndex}
      data-row-id={ctx?.rowId}
      data-col={navCol}
      data-grid-key={cellId}
      data-grid-editing={editing ? 'true' : 'false'}
      onChange={e => { if (editing) setLocal(e.target.value); }}
      onMouseDown={e => {
        ctx?.onCellMouseDown(e);
        pointerDownRef.current = true;
        if (!editing) setEditing(true);
      }}
      onFocus={() => {
        setFocused(true);
        if (!pointerDownRef.current) setEditing(false);
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
          const startEditingWithKey = (key: string) => {
            setEditing(true);
            setLocal(key);
            requestAnimationFrame(() => focusInputAtEnd(ref.current));
          };

          if (!ctx) {
            if (e.key === 'Enter') {
              if (!editing) {
                e.preventDefault();
                setEditing(true);
                requestAnimationFrame(() => focusInputAtEnd(ref.current));
              } else {
                e.preventDefault();
                commit();
                setEditing(false);
                requestAnimationFrame(() => ref.current?.focus());
              }
              return;
            }
            if (!editing && isPrintableEntryKey(e)) {
              e.preventDefault();
              startEditingWithKey(e.key);
            }
            return;
          }

          if (!editing) {
            if (e.key === 'Enter') {
              e.preventDefault();
              setEditing(true);
              requestAnimationFrame(() => focusInputAtEnd(ref.current));
              return;
            }
            if (isPrintableEntryKey(e)) {
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
          requestAnimationFrame(() => ref.current?.focus());
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setLocal(String(value));
          setEditing(false);
          requestAnimationFrame(() => ref.current?.focus());
          return;
        }

        if (e.key === 'Tab') {
          suppressBlurCommitRef.current = true;
          commit();
          const moved = ctx.onCellKeyDown(e);
          if (!moved) suppressBlurCommitRef.current = false;
        }
      }}
      className={cn(CELL_INPUT_CLASS, navCol === 0 && STICKY_COL_INPUT_HOVER_CLASS, !editing && 'caret-transparent', className)}
    />
  );
}

export function GridCurrencyCell({ value, onChange, navCol, className }: {
  value: number;
  onChange: (v: string) => void;
  navCol: number;
  className?: string;
}) {
  const ctx = useDataGrid();
  const [local, setLocal] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);
  const suppressBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!focused || !editing) setLocal(String(value));
  }, [value, focused, editing]);

  const commit = () => {
    if (local !== String(value)) {
      ctx?.onCellCommit(navCol);
      onChange(local);
    }
  };

  return (
    <div className="relative min-w-[5rem]">
      <span className={cn('pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 !text-xs font-normal', GRID_READONLY_TEXT_CLASS)}>$</span>
      <Input
        ref={ref}
        type="number"
        value={local}
        readOnly={!editing}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={navCol}
        data-grid-editing={editing ? 'true' : 'false'}
        onChange={e => { if (editing) setLocal(e.target.value); }}
        onMouseDown={e => {
          ctx?.onCellMouseDown(e);
          pointerDownRef.current = true;
          if (!editing) setEditing(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (!pointerDownRef.current) setEditing(false);
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
          const startEditingWithKey = (key: string) => {
            setEditing(true);
            setLocal(key);
            requestAnimationFrame(() => focusInputAtEnd(ref.current));
          };

          if (!ctx) {
            if (e.key === 'Enter') {
              if (!editing) {
                e.preventDefault();
                setEditing(true);
                requestAnimationFrame(() => focusInputAtEnd(ref.current));
              } else {
                e.preventDefault();
                commit();
                setEditing(false);
                requestAnimationFrame(() => ref.current?.focus());
              }
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
              setEditing(true);
              requestAnimationFrame(() => focusInputAtEnd(ref.current));
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
            requestAnimationFrame(() => ref.current?.focus());
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            setLocal(String(value));
            setEditing(false);
            requestAnimationFrame(() => ref.current?.focus());
            return;
          }

          if (e.key === 'Tab') {
            suppressBlurCommitRef.current = true;
            commit();
            const moved = ctx.onCellKeyDown(e);
            if (!moved) suppressBlurCommitRef.current = false;
          }
        }}
        className={cn(CELL_INPUT_CLASS, navCol === 0 && STICKY_COL_INPUT_HOVER_CLASS, 'pl-4 !text-right', !editing && 'caret-transparent', className)}
      />
    </div>
  );
}

export function GridPercentCell({ value, onChange, navCol, className }: {
  value: number;
  onChange: (v: string) => void;
  navCol: number;
  className?: string;
}) {
  const ctx = useDataGrid();
  const [local, setLocal] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);
  const suppressBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!focused || !editing) setLocal(String(value));
  }, [value, focused, editing]);

  const commit = () => {
    if (local !== String(value)) {
      ctx?.onCellCommit(navCol);
      onChange(local);
    }
  };

  return (
    <div className="relative min-w-[4rem]">
      <span className={cn('pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 !text-xs font-normal', GRID_READONLY_TEXT_CLASS)}>%</span>
      <Input
        ref={ref}
        type="number"
        value={local}
        min={0}
        max={100}
        readOnly={!editing}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={navCol}
        data-grid-editing={editing ? 'true' : 'false'}
        onChange={e => { if (editing) setLocal(e.target.value); }}
        onMouseDown={e => {
          ctx?.onCellMouseDown(e);
          pointerDownRef.current = true;
          if (!editing) setEditing(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (!pointerDownRef.current) setEditing(false);
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
          const startEditingWithKey = (key: string) => {
            setEditing(true);
            setLocal(key);
            requestAnimationFrame(() => focusInputAtEnd(ref.current));
          };

          if (!ctx) {
            if (e.key === 'Enter') {
              if (!editing) {
                e.preventDefault();
                setEditing(true);
                requestAnimationFrame(() => focusInputAtEnd(ref.current));
              } else {
                e.preventDefault();
                commit();
                setEditing(false);
                requestAnimationFrame(() => ref.current?.focus());
              }
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
              setEditing(true);
              requestAnimationFrame(() => focusInputAtEnd(ref.current));
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
            requestAnimationFrame(() => ref.current?.focus());
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            setLocal(String(value));
            setEditing(false);
            requestAnimationFrame(() => ref.current?.focus());
            return;
          }

          if (e.key === 'Tab') {
            suppressBlurCommitRef.current = true;
            commit();
            const moved = ctx.onCellKeyDown(e);
            if (!moved) suppressBlurCommitRef.current = false;
          }
        }}
        className={cn(CELL_INPUT_CLASS, navCol === 0 && STICKY_COL_INPUT_HOVER_CLASS, 'pr-6 !text-right', !editing && 'caret-transparent', className)}
      />
    </div>
  );
}
