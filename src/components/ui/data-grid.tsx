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
  onCellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onCellMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
}

const DataGridCtx = createContext<DataGridContextValue | null>(null);
export function useDataGrid() { return useContext(DataGridCtx); }

/** Spread onto any interactive element to wire it into grid keyboard navigation. */
export function gridNavProps(ctx: DataGridContextValue | null, navCol: number): Record<string, unknown> {
  return {
    'data-row': ctx?.rowIndex,
    'data-col': navCol,
    onKeyDown: ctx?.onCellKeyDown,
    onMouseDown: ctx?.onCellMouseDown,
  };
}

// ─── Keyboard Navigation ───
function useGridNav(containerRef: React.RefObject<HTMLDivElement | null>) {
  const getEditableCells = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-row][data-col]'));
  }, [containerRef]);

  const focusCell = useCallback((row: number, col: number) => {
    const cells = getEditableCells();
    const target = cells.find(el => Number(el.dataset.row) === row && Number(el.dataset.col) === col);
    if (target) {
      const role = target.getAttribute('role');
      if (target.tagName === 'BUTTON' && role !== 'checkbox' && role !== 'combobox') target.click();
      else target.focus();
      return true;
    }
    return false;
  }, [getEditableCells]);

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

  const onCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    if (isNaN(row) || isNaN(col)) return;

    const target = e.target;
    const isTextInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const isEditing = target instanceof HTMLElement && target.dataset.gridEditing === 'true';

    const moveTo = (nextRow: number, nextCol: number) => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      requestAnimationFrame(() => focusCell(nextRow, nextCol));
    };

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? findPrevCol(row, col) : findNextCol(row, col);
      if (nextCol === null) return;
      moveTo(row, nextCol);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (isTextInput && isEditing) return;
      const maxRow = getMaxRow();
      const nextRow = e.key === 'ArrowUp' ? Math.max(0, row - 1) : Math.min(maxRow, row + 1);
      if (nextRow === row) return;
      e.preventDefault();
      moveTo(nextRow, col);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;

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

      if (!shouldNavigate) return;

      const nextCol = e.key === 'ArrowLeft' ? findPrevCol(row, col) : findNextCol(row, col);
      if (nextCol === null) return;
      e.preventDefault();
      moveTo(row, nextCol);
    }
  }, [findNextCol, findPrevCol, focusCell, getMaxRow]);

  const onCellMouseDown = useCallback((_e: React.MouseEvent<HTMLElement>) => {}, []);

  return { onCellKeyDown, onCellMouseDown };
}

// ─── DataGrid ───
interface DataGridProps<TData> {
  table: TanStackTable<TData>;
  footer?: React.ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
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
  stickyFirstColumn = true,
  groupBy,
  renderGroupHeader,
  groupOrder,
}: DataGridProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onCellKeyDown, onCellMouseDown } = useGridNav(containerRef);
  const rows = table.getRowModel().rows;

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

  let visualRowIdx = 0;

  const renderDataRow = (row: Row<TData>) => {
    const currentRow = visualRowIdx++;
    return (
      <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
        {row.getVisibleCells().map((cell, colIdx) => {
          const meta = cell.column.columnDef.meta;
          return (
            <td
              key={cell.id}
              className={cn(
                'px-2 py-1 align-middle',
                colIdx === 0 && stickyFirstColumn && 'sticky left-0 z-10 bg-background',
                meta?.cellClassName,
              )}
            >
              <DataGridCtx.Provider value={{ rowIndex: currentRow, onCellKeyDown, onCellMouseDown }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </DataGridCtx.Provider>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div ref={containerRef} className={cn('overflow-auto', className)} style={{ maxHeight }}>
      <table className="w-full caption-bottom text-xs">
        <thead className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_tr]:border-b-0">
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="border-b transition-colors">
              {hg.headers.map((header, colIdx) => {
                const meta = header.column.columnDef.meta;
                const sortState = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'h-9 px-2 text-left align-middle font-medium text-muted-foreground',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:bg-muted/50',
                      colIdx === 0 && stickyFirstColumn && 'sticky left-0 z-40 bg-card',
                      meta?.headerClassName,
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && sortState === 'asc' && <ArrowUp className="h-3 w-3" />}
                        {header.column.getCanSort() && sortState === 'desc' && <ArrowDown className="h-3 w-3" />}
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
              <td colSpan={table.getAllColumns().length} className="px-2 py-8 text-center text-muted-foreground">
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
          <tfoot className="border-t bg-muted/50 font-medium [&>tr]:last:border-b-0 sticky bottom-0 z-30">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Cell Primitives ───
const CELL_INPUT_CLASS = 'h-7 rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-transparent focus:ring-2 focus:ring-ring !text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

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
  input.setSelectionRange(end, end);
}

export function GridEditableCell({ value, onChange, navCol, type = 'text', className, placeholder }: {
  value: string | number;
  onChange: (v: string) => void;
  navCol: number;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  const ctx = useDataGrid();
  const [local, setLocal] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef(false);

  useEffect(() => {
    if (!focused || !editing) setLocal(String(value));
  }, [value, focused, editing]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <Input
      ref={ref}
      type={type}
      value={local}
      readOnly={!editing}
      placeholder={placeholder}
      data-row={ctx?.rowIndex}
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
        if (editing) commit();
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
          commit();
          ctx.onCellKeyDown(e);
        }
      }}
      className={cn(CELL_INPUT_CLASS, !editing && 'caret-transparent', className)}
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

  useEffect(() => {
    if (!focused || !editing) setLocal(String(value));
  }, [value, focused, editing]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <div className="relative min-w-[5rem]">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 !text-xs text-muted-foreground">$</span>
      <Input
        ref={ref}
        type="number"
        value={local}
        readOnly={!editing}
        data-row={ctx?.rowIndex}
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
          if (editing) commit();
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
            commit();
            ctx.onCellKeyDown(e);
          }
        }}
        className={cn(CELL_INPUT_CLASS, 'pl-4 !text-right', !editing && 'caret-transparent', className)}
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

  useEffect(() => {
    if (!focused || !editing) setLocal(String(value));
  }, [value, focused, editing]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <div className="relative min-w-[4rem]">
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 !text-xs text-muted-foreground">%</span>
      <Input
        ref={ref}
        type="number"
        value={local}
        min={0}
        max={100}
        readOnly={!editing}
        data-row={ctx?.rowIndex}
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
          if (editing) commit();
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
            commit();
            ctx.onCellKeyDown(e);
          }
        }}
        className={cn(CELL_INPUT_CLASS, 'pr-6 !text-right', !editing && 'caret-transparent', className)}
      />
    </div>
  );
}
