import * as React from 'react';
import { useState, useRef, useCallback, useContext, createContext, useEffect } from 'react';
import {
  flexRender,
  type Table as TanStackTable,
  type Row,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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
    const next = cols.find(c => c > currentCol);
    if (next !== undefined) return { row, col: next };
    const maxRow = getMaxRow();
    const nextRow = row < maxRow ? row + 1 : 0;
    const nextCols = cells.filter(c => Number(c.dataset.row) === nextRow).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    return { row: nextRow, col: nextCols[0] ?? 0 };
  }, [getEditableCells, getMaxRow]);

  const findPrevCol = useCallback((row: number, currentCol: number) => {
    const cells = getEditableCells();
    const cols = cells.filter(c => Number(c.dataset.row) === row).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    const prev = cols.filter(c => c < currentCol);
    if (prev.length > 0) return { row, col: prev[prev.length - 1] };
    const maxRow = getMaxRow();
    const prevRow = row > 0 ? row - 1 : maxRow;
    const prevCols = cells.filter(c => Number(c.dataset.row) === prevRow).map(c => Number(c.dataset.col)).sort((a, b) => a - b);
    return { row: prevRow, col: prevCols[prevCols.length - 1] ?? 0 };
  }, [getEditableCells, getMaxRow]);

  const onCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    if (isNaN(row) || isNaN(col)) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      requestAnimationFrame(() => {
        const dest = e.shiftKey ? findPrevCol(row, col) : findNextCol(row, col);
        focusCell(dest.row, dest.col);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const maxRow = getMaxRow();
      const nextRow = e.shiftKey ? (row > 0 ? row - 1 : null) : (row < maxRow ? row + 1 : null);
      if (nextRow === null) return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      requestAnimationFrame(() => focusCell(nextRow, col));
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
    return { map, order };
  }, [groupBy, rows]);

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
                        {header.column.getCanSort() && (
                          header.column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> :
                          header.column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> :
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
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
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!focused) setLocal(String(value)); }, [value, focused]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <Input
      ref={ref}
      type={type}
      value={local}
      placeholder={placeholder}
      data-row={ctx?.rowIndex}
      data-col={navCol}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { commit(); setFocused(false); }}
      onKeyDown={e => { if (ctx) ctx.onCellKeyDown(e); else if (e.key === 'Enter') ref.current?.blur(); }}
      onMouseDown={ctx?.onCellMouseDown}
      className={cn(CELL_INPUT_CLASS, className)}
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
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!focused) setLocal(String(value)); }, [value, focused]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <div className="min-w-[5rem]">
      {focused ? (
        <Input
          ref={ref}
          type="number"
          value={local}
          data-row={ctx?.rowIndex}
          data-col={navCol}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { commit(); setFocused(false); }}
          onKeyDown={e => { if (ctx) ctx.onCellKeyDown(e); else if (e.key === 'Enter') ref.current?.blur(); }}
          onMouseDown={ctx?.onCellMouseDown}
          autoFocus
          className={cn(CELL_INPUT_CLASS, className)}
        />
      ) : (
        <button
          type="button"
          data-row={ctx?.rowIndex}
          data-col={navCol}
          onClick={() => setFocused(true)}
          onMouseDown={ctx?.onCellMouseDown}
          className={cn('h-7 w-full bg-transparent px-1 !text-xs text-right cursor-pointer border border-transparent hover:border-border rounded-md underline decoration-dashed decoration-muted-foreground/40 underline-offset-2', className)}
        >
          ${Math.round(Number(local) || 0)}
        </button>
      )}
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
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!focused) setLocal(String(value)); }, [value, focused]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <div className="min-w-[4rem]">
      {focused ? (
        <Input
          ref={ref}
          type="number"
          value={local}
          min={0}
          max={100}
          data-row={ctx?.rowIndex}
          data-col={navCol}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { commit(); setFocused(false); }}
          onKeyDown={e => { if (ctx) ctx.onCellKeyDown(e); else if (e.key === 'Enter') ref.current?.blur(); }}
          onMouseDown={ctx?.onCellMouseDown}
          autoFocus
          className={cn(CELL_INPUT_CLASS, className)}
        />
      ) : (
        <button
          type="button"
          data-row={ctx?.rowIndex}
          data-col={navCol}
          onClick={() => setFocused(true)}
          onMouseDown={ctx?.onCellMouseDown}
          className={cn('h-7 w-full bg-transparent px-1 !text-xs text-right cursor-pointer border border-transparent hover:border-border rounded-md underline decoration-dashed decoration-muted-foreground/40 underline-offset-2', className)}
        >
          {Math.round(Number(local) || 0)}%
        </button>
      )}
    </div>
  );
}
