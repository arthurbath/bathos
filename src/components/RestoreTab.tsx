import { forwardRef, useCallback, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type KeyboardEventHandler, type MouseEventHandler, type PointerEventHandler } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, MoreHorizontal, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import type { RestorePoint } from '@/hooks/useRestorePoints';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Json } from '@/integrations/supabase/types';
import { CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS, GRID_ACTIONS_COLUMN_ID, GRID_FIXED_COLUMNS, GRID_MIN_COLUMN_WIDTH } from '@/lib/gridColumnWidths';

interface RestoreTabProps {
  userId?: string;
  points: RestorePoint[];
  pendingById?: Record<string, boolean>;
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  linkedAccounts: LinkedAccount[];
  onSave: (notes: string, snapshot: Json, id?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onRestore: (data: Json) => Promise<void>;
}

const restorePointColumnHelper = createColumnHelper<RestorePoint>();
const BACKUP_ACTIONS_NAV_COL = 2;
const RESTORE_POINTS_HISTORY_KEY = 'config_backups';
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';

const BackupActionsTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button>>(function BackupActionsTrigger({
  onKeyDown,
  onMouseDown,
  onPointerDown,
  ...props
}, ref) {
  const ctx = useDataGrid();
  const navProps = gridMenuTriggerProps(ctx, BACKUP_ACTIONS_NAV_COL) as ComponentPropsWithoutRef<typeof Button>;

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
      aria-label="Backup actions"
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function RestoreTab({
  userId,
  points,
  pendingById = {},
  incomes,
  expenses,
  categories,
  linkedAccounts,
  onSave,
  onRemove,
  onUpdateNotes,
  onRestore,
}: RestoreTabProps) {
  const dataGridHistory = useDataGridHistory();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestorePoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestorePoint | null>(null);

  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [{ id: 'timestamp', desc: true }];
    try {
      const raw = window.localStorage.getItem('config_backups_sorting');
      return raw ? JSON.parse(raw) : [{ id: 'timestamp', desc: true }];
    } catch {
      return [{ id: 'timestamp', desc: true }];
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('config_backups_sorting', JSON.stringify(sorting));
  }, [sorting]);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'config_backups',
    defaults: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.config_backups,
  });

  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const snapshot: Json = {
        incomes: incomes.map(({
          id,
          name,
          amount,
          frequency_type,
          frequency_param,
          partner_label,
          is_estimate,
          value_type,
          current_period_handling,
          average_records,
        }) =>
          ({ id, name, amount, frequency_type, frequency_param, partner_label, is_estimate, value_type, current_period_handling, average_records })
        ) as unknown as Json,
        expenses: expenses.map(({
          id,
          name,
          amount,
          frequency_type,
          frequency_param,
          benefit_x,
          category_id,
          linked_account_id,
          budget_id,
          is_estimate,
          value_type,
          current_period_handling,
          average_records,
        }) =>
          ({ id, name, amount, frequency_type, frequency_param, benefit_x, category_id, linked_account_id, budget_id, is_estimate, value_type, current_period_handling, average_records })
        ) as unknown as Json,
        categories: categories.map(({ id, name, color }) => ({ id, name, color })) as unknown as Json,
        linkedAccounts: linkedAccounts.map(({ id, name, color, owner_partner }) => ({ id, name, color, owner_partner })) as unknown as Json,
      };
      const restorePointId = crypto.randomUUID();
      const normalizedNotes = notes.trim();
      dataGridHistory?.recordHistoryEntry({
        undo: () => onRemove(restorePointId),
        redo: () => onSave(normalizedNotes, snapshot, restorePointId),
        undoFocusTarget: null,
        redoFocusTarget: {
          gridId: RESTORE_POINTS_HISTORY_KEY,
          rowId: restorePointId,
          col: 1,
        },
      });
      await onSave(normalizedNotes, snapshot, restorePointId);
      setNotes('');
      setAddDialogOpen(false);
      toast({ title: 'Snapshot saved' });
    } catch (error: unknown) {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      await onRestore(restoreTarget.data);
      toast({ title: 'Restored', description: `Restored from ${formatTimestamp(restoreTarget.created_at)}` });
    } catch (error: unknown) {
      toast({ title: 'Error restoring', description: getErrorMessage(error), variant: 'destructive' });
    }
    setRestoreTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      dataGridHistory?.recordHistoryEntry({
        undo: () => onSave(deleteTarget.notes ?? '', deleteTarget.data, deleteTarget.id),
        redo: () => onRemove(deleteTarget.id),
        undoFocusTarget: {
          gridId: RESTORE_POINTS_HISTORY_KEY,
          rowId: deleteTarget.id,
          col: 1,
        },
        redoFocusTarget: null,
      });
      await onRemove(deleteTarget.id);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const columns = useMemo(
    () => [
      restorePointColumnHelper.accessor('created_at', {
        id: 'timestamp',
        header: 'Timestamp',
        size: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS.timestamp,
        minSize: GRID_MIN_COLUMN_WIDTH,
        cell: ({ row }) => <span className="font-medium">{formatTimestamp(row.original.created_at)}</span>,
      }),
      restorePointColumnHelper.accessor((row) => row.notes ?? '', {
        id: 'notes',
        header: 'Notes',
        size: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS.notes,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { containsEditableInput: true },
        cell: ({ row }) => {
          const point = row.original;
          const isPending = !!pendingById[point.id];
          return (
            <GridEditableCell
              value={point.notes ?? ''}
              navCol={1}
              disabled={isPending}
              deleteResetValue=""
              normalizeOnCommit={(value) => value.trim()}
              onChange={async (nextValue) => {
                try {
                  await onUpdateNotes(point.id, nextValue);
                } catch (error: unknown) {
                  toast({ title: 'Error updating notes', description: getErrorMessage(error), variant: 'destructive' });
                  throw error;
                }
              }}
            />
          );
        },
      }),
      restorePointColumnHelper.display({
        id: GRID_ACTIONS_COLUMN_ID,
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        minSize: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        maxSize: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => {
          const point = row.original;
          const isPending = !!pendingById[point.id];
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <BackupActionsTrigger disabled={isPending} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => setRestoreTarget(point)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteTarget(point)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [onUpdateNotes, pendingById],
  );

  const table = useReactTable({
    data: points,
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
            <CardTitle>Backups</CardTitle>
            <Button
              onClick={() => {
                if (saving) return;
                setNotes('');
                setAddDialogOpen(true);
              }}
              disabled={saving}
              variant="outline-success"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Create backup"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2.5">
          {points.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No backups yet.</p>
          ) : (
            <DataGrid table={table} historyKey={RESTORE_POINTS_HISTORY_KEY} maxHeight="none" stickyFirstColumn={false} />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setAddDialogOpen(false);
            setNotes('');
            return;
          }
          if (open) setAddDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <DialogDescription>Save a snapshot of your current categories, payment methods, incomes, and expenses.</DialogDescription>
            <Label htmlFor="backup-notes">Notes</Label>
            <Input
              id="backup-notes"
              placeholder="Backup notes (optional)"
              value={notes}
              autoFocus
              disabled={saving}
              onChange={(event) => setNotes(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSave();
                }
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setNotes('');
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button data-dialog-confirm="true" variant="outline-success" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!restoreTarget} onOpenChange={open => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore snapshot from {restoreTarget ? formatTimestamp(restoreTarget.created_at) : ''}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              This will replace all your current categories, incomes, and expenses with the data from this snapshot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmRestore()}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete backup from {deleteTarget ? formatTimestamp(deleteTarget.created_at) : ''}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void handleConfirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
