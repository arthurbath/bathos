import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type KeyboardEventHandler, type MouseEventHandler, type PointerEventHandler } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, gridNavProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import { COLOR_SWATCHES, normalizePaletteColor } from '@/lib/colors';
import { CONFIG_CATEGORIES_GRID_DEFAULT_WIDTHS, GRID_ACTIONS_COLUMN_ID, GRID_FIXED_COLUMNS, GRID_MIN_COLUMN_WIDTH } from '@/lib/gridColumnWidths';

interface ManagedItem {
  id: string;
  name: string;
  color?: string | null;
}

interface ManagedListSectionProps {
  title: string;
  description: string;
  historyKey?: string;
  userId?: string;
  items: ManagedItem[];
  getUsageCount: (id: string) => number;
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRestoreItem?: (item: ManagedItem) => Promise<void>;
  onReassign?: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateColor?: (id: string, color: string | null) => Promise<void>;
  pendingById?: Record<string, boolean>;
  reassignDeletesTarget?: boolean;
}

const managedItemColumnHelper = createColumnHelper<ManagedItem>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function ColorPicker({
  color,
  onChange,
  disabled = false,
  navCol,
}: {
  color: string | null | undefined;
  onChange: (c: string | null) => void | Promise<void>;
  disabled?: boolean;
  navCol?: number;
}) {
  const ctx = useDataGrid();
  const [open, setOpen] = useState(false);
  const normalizedColor = normalizePaletteColor(color);
  const selectedSwatch = COLOR_SWATCHES.find((swatch) => swatch.value === normalizedColor) ?? null;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const swatchRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoreTriggerFocusRef = useRef(false);
  const SWATCH_COLUMNS = 5;

  const focusTrigger = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }
    triggerRef.current?.focus();
  }, []);

  const focusSwatchByIndex = useCallback((index: number) => {
    const target = COLOR_SWATCHES[index];
    if (!target) return;
    swatchRefs.current[target.slug]?.focus();
  }, []);

  const focusInitialSwatch = useCallback(() => {
    const firstSwatch = COLOR_SWATCHES[0];
    if (!firstSwatch) return;
    const preferredSlug = selectedSwatch?.slug ?? firstSwatch.slug;
    const preferredIndex = COLOR_SWATCHES.findIndex((swatch) => swatch.slug === preferredSlug);
    focusSwatchByIndex(preferredIndex >= 0 ? preferredIndex : 0);
  }, [focusSwatchByIndex, selectedSwatch]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    if (!open || disabled) return;

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      let nextFrameId = 0;
      const frameId = window.requestAnimationFrame(() => {
        nextFrameId = window.requestAnimationFrame(() => focusInitialSwatch());
      });
      return () => {
        window.cancelAnimationFrame(frameId);
        if (nextFrameId) window.cancelAnimationFrame(nextFrameId);
      };
    }

    focusInitialSwatch();
  }, [disabled, focusInitialSwatch, open]);

  useEffect(() => {
    if (open || !restoreTriggerFocusRef.current) return;
    restoreTriggerFocusRef.current = false;
    focusTrigger();
  }, [focusTrigger, open]);

  const handleChange = (nextColor: string | null) => {
    if (disabled) return;
    const historyEntryId = ctx?.registerCellHistoryEntry({
      col: navCol ?? 0,
      undo: () => onChange(color ?? null),
      redo: () => onChange(nextColor),
    });
    ctx?.onCellCommit(navCol ?? 0);
    const maybePendingChange = onChange(nextColor);
    if (maybePendingChange && typeof maybePendingChange === 'object' && 'catch' in maybePendingChange && typeof maybePendingChange.catch === 'function') {
      void maybePendingChange.catch(() => {
        ctx?.invalidateCellHistoryEntry(historyEntryId);
      });
    }
    restoreTriggerFocusRef.current = true;
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { if (!disabled) setOpen(nextOpen); }}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={`relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--grid-sticky-line))] bg-transparent p-0 transition-[filter,border-color,background-color,box-shadow] ${normalizedColor ? 'hover:brightness-125 hover:border-foreground/40 hover:shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.16)]' : 'hover:bg-muted hover:border-foreground/40 hover:shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.12)]'} focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50`}
          style={normalizedColor ? { backgroundColor: normalizedColor } : undefined}
          title="Pick color"
          disabled={disabled}
          data-grid-focus-only="true"
          {...(typeof navCol === 'number' ? gridNavProps(ctx, navCol) : {})}
          onKeyDown={(event) => {
            if (ctx?.onCellKeyDown(event)) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (!disabled) setOpen(true);
          }}
        >
          {!normalizedColor && <span className="absolute text-[10px] text-muted-foreground">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={() => {
          restoreTriggerFocusRef.current = true;
        }}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_SWATCHES.map((swatch, index) => (
            <button
              type="button"
              key={swatch.slug}
              ref={(node) => {
                swatchRefs.current[swatch.slug] = node;
              }}
              className={`h-6 w-6 rounded border border-[hsl(var(--grid-sticky-line))] transition-shadow focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0 ${normalizedColor === swatch.value ? 'ring-2 ring-ring border-ring' : 'hover:ring-1 hover:ring-ring'}`}
              style={{ backgroundColor: swatch.value }}
              title={swatch.label}
              aria-label={`Use ${swatch.label}`}
              onClick={() => handleChange(swatch.value)}
              onKeyDown={(event) => {
                const lastIndex = COLOR_SWATCHES.length - 1;
                let nextIndex = index;

                if (event.key === 'ArrowRight') nextIndex = Math.min(lastIndex, index + 1);
                else if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
                else if (event.key === 'ArrowDown') nextIndex = Math.min(lastIndex, index + SWATCH_COLUMNS);
                else if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - SWATCH_COLUMNS);
                else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = lastIndex;
                else return;

                event.preventDefault();
                focusSwatchByIndex(nextIndex);
              }}
            />
          ))}
        </div>
        {color && (
          <button
            type="button"
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => handleChange(null)}
          >
            <X className="h-3 w-3" /> Remove color
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { ColorPicker };

type ManagedListActionsTriggerProps = ComponentPropsWithoutRef<typeof Button> & {
  navCol: number;
  ariaLabel: string;
};

const ManagedListActionsTrigger = forwardRef<HTMLButtonElement, ManagedListActionsTriggerProps>(function ManagedListActionsTrigger({
  navCol,
  ariaLabel,
  onKeyDown,
  onMouseDown,
  onPointerDown,
  ...props
}, ref) {
  const ctx = useDataGrid();
  const navProps = gridMenuTriggerProps(ctx, navCol) as ComponentPropsWithoutRef<typeof Button>;

  const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
    (navProps.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined)?.(event);
    if (!event.defaultPrevented) {
      onKeyDown?.(event);
    }
  };

  const handleMouseDown: MouseEventHandler<HTMLButtonElement> = (event) => {
    (navProps.onMouseDown as MouseEventHandler<HTMLButtonElement> | undefined)?.(event);
    if (!event.defaultPrevented) {
      onMouseDown?.(event);
    }
  };

  const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
    (navProps.onPointerDown as PointerEventHandler<HTMLButtonElement> | undefined)?.(event);
    if (!event.defaultPrevented) {
      onPointerDown?.(event);
    }
  };

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      type="button"
      className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
      aria-label={ariaLabel}
      {...props}
      {...navProps}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
});

export function ManagedListSection({
  title,
  description,
  historyKey = 'config_categories',
  userId,
  items,
  getUsageCount,
  onAdd,
  onUpdate,
  onRemove,
  onRestoreItem,
  onReassign,
  onUpdateColor,
  pendingById = {},
  reassignDeletesTarget = false,
}: ManagedListSectionProps) {
  const dataGridHistory = useDataGridHistory();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedItem | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('_none');

  const singularLabel = useMemo(
    () => title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, ''),
    [title],
  );

  const sortingStorageKey = useMemo(
    () => `config_${title.toLowerCase().replace(/\s+/g, '_')}_sorting`,
    [title],
  );
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [{ id: 'name', desc: false }];
    try {
      const raw = window.localStorage.getItem(sortingStorageKey);
      return raw ? JSON.parse(raw) : [{ id: 'name', desc: false }];
    } catch {
      return [{ id: 'name', desc: false }];
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(sortingStorageKey, JSON.stringify(sorting));
  }, [sorting, sortingStorageKey]);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'config_categories',
    defaults: CONFIG_CATEGORIES_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.config_categories,
  });

  const handleAdd = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    setAdding(true);
    try {
      if (onRestoreItem) {
        const itemId = crypto.randomUUID();
        const item = { id: itemId, name: nextName, color: null };
        dataGridHistory?.recordHistoryEntry({
          undo: () => onRemove(itemId),
          redo: () => onRestoreItem(item),
          undoFocusTarget: null,
          redoFocusTarget: {
            gridId: historyKey,
            rowId: itemId,
            col: 0,
          },
        });
        await onRestoreItem(item);
      } else {
        await onAdd(nextName);
      }
      setName('');
      setAddDialogOpen(false);
    } catch (error: unknown) {
      toast({ title: `Error adding ${singularLabel}`, description: getErrorMessage(error), variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleRename = useCallback(async (id: string, nextRaw: string) => {
    const nextName = nextRaw.trim();
    const currentName = items.find((item) => item.id === id)?.name ?? '';
    if (!nextName || nextName === currentName) return;
    try {
      await onUpdate(id, nextName);
    } catch (error: unknown) {
      toast({ title: 'Error renaming', description: getErrorMessage(error), variant: 'destructive' });
    }
  }, [items, onUpdate]);

  const doDelete = useCallback(async (id: string) => {
    try {
      const item = items.find((entry) => entry.id === id);
      if (item && onRestoreItem) {
        dataGridHistory?.recordHistoryEntry({
          undo: () => onRestoreItem(item),
          redo: () => onRemove(id),
          undoFocusTarget: {
            gridId: historyKey,
            rowId: id,
            col: 0,
          },
          redoFocusTarget: null,
        });
      }
      await onRemove(id);
    } catch (error: unknown) {
      toast({ title: 'Error removing', description: getErrorMessage(error), variant: 'destructive' });
    }
  }, [dataGridHistory, historyKey, items, onRemove, onRestoreItem]);

  const handleDeleteClick = useCallback((item: ManagedItem) => {
    const count = getUsageCount(item.id);
    if (count > 0 && onReassign) {
      setDeleteTarget(item);
      setReassignTo('_none');
      return;
    }
    void doDelete(item.id);
  }, [doDelete, getUsageCount, onReassign]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onReassign) return;
    try {
      if (onRestoreItem) {
        dataGridHistory?.recordHistoryEntry({
          undo: () => onRestoreItem(deleteTarget),
          redo: async () => {
            await onReassign(deleteTarget.id, reassignTo === '_none' ? null : reassignTo);
            if (!reassignDeletesTarget) {
              await onRemove(deleteTarget.id);
            }
          },
          undoFocusTarget: {
            gridId: historyKey,
            rowId: deleteTarget.id,
            col: 0,
          },
          redoFocusTarget: null,
        });
      }
      await onReassign(deleteTarget.id, reassignTo === '_none' ? null : reassignTo);
      if (!reassignDeletesTarget) {
        await onRemove(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const affectedCount = deleteTarget ? getUsageCount(deleteTarget.id) : 0;
  const columns = useMemo(
    () => [
      managedItemColumnHelper.accessor('name', {
        id: 'name',
        header: 'Name',
        size: 300,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { containsEditableInput: true },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = !!pendingById[item.id];
          return (
            <GridEditableCell
              value={item.name}
              navCol={0}
              disabled={isPending}
              onChange={(nextValue) => {
                void handleRename(item.id, nextValue);
              }}
            />
          );
        },
      }),
      ...(onUpdateColor
        ? [
            managedItemColumnHelper.display({
              id: 'color',
              header: 'Color',
              size: GRID_MIN_COLUMN_WIDTH,
              minSize: GRID_MIN_COLUMN_WIDTH,
              meta: { containsButton: true },
              cell: ({ row }) => {
                const item = row.original;
                const isPending = !!pendingById[item.id];
                return (
                  <ColorPicker
                    color={item.color}
                    disabled={isPending}
                    navCol={1}
                    onChange={(nextColor) => {
                      void onUpdateColor(item.id, nextColor);
                    }}
                  />
                );
              },
            }),
          ]
        : []),
      managedItemColumnHelper.accessor((row) => getUsageCount(row.id), {
        id: 'expenses',
        header: 'Expenses',
        size: 110,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
        cell: ({ getValue }) => getValue(),
      }),
      managedItemColumnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: CONFIG_CATEGORIES_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        minSize: CONFIG_CATEGORIES_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        maxSize: CONFIG_CATEGORIES_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = !!pendingById[item.id];
          const actionsNavCol = onUpdateColor ? 2 : 1;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ManagedListActionsTrigger
                  navCol={actionsNavCol}
                  ariaLabel={`Actions for ${item.name}`}
                  disabled={isPending}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleDeleteClick(item)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [getUsageCount, handleDeleteClick, handleRename, onUpdateColor, pendingById],
  );

  const table = useReactTable({
    data: items,
    columns,
    defaultColumn: { minSize: GRID_MIN_COLUMN_WIDTH },
    state: { sorting, columnSizing, columnSizingInfo },
    enableColumnResizing: columnResizingEnabled,
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Button
              onClick={() => {
                if (adding) return;
                setName('');
                setAddDialogOpen(true);
              }}
              disabled={adding}
              variant="outline-success"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Add ${singularLabel}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2.5">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>
          ) : (
            <DataGrid table={table} historyKey={historyKey} maxHeight="none" stickyFirstColumn={false} />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open && !adding) {
            setAddDialogOpen(false);
            setName('');
            return;
          }
          if (open) setAddDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {singularLabel}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <Label htmlFor={`${title.toLowerCase().replace(/\s+/g, '-')}-name`}>Name</Label>
            <Input
              id={`${title.toLowerCase().replace(/\s+/g, '-')}-name`}
              placeholder={`New ${singularLabel} name`}
              value={name}
              autoFocus
              disabled={adding}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setName('');
              }}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button data-dialog-confirm="true" variant="outline-success" onClick={() => void handleAdd()} disabled={adding || !name.trim()}>
              {adding ? 'Saving...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              {affectedCount} expense{affectedCount !== 1 ? 's' : ''} use this. Choose where to reassign:
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <Label>Reassign To</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {items.filter(i => i.id !== deleteTarget?.id).map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button data-dialog-confirm="true" variant="destructive" onClick={() => void handleConfirmDelete()}>Delete & Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
