import { forwardRef, useCallback, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type KeyboardEventHandler, type MouseEventHandler } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, MoreHorizontal, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
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
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  linkedAccounts: LinkedAccount[];
  onSave: (notes: string, snapshot: Json) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onRestore: (data: Json) => Promise<void>;
}

const restorePointColumnHelper = createColumnHelper<RestorePoint>();
const BACKUP_ACTIONS_NAV_COL = 2;
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';

const BackupActionsTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button>>(function BackupActionsTrigger({
  onKeyDown,
  onMouseDown,
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
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
});

export function RestoreTab({ userId, points, incomes, expenses, categories, linkedAccounts, onSave, onRemove, onUpdateNotes, onRestore }: RestoreTabProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestorePoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestorePoint | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');

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
        incomes: incomes.map(({ id, name, amount, frequency_type, frequency_param, partner_label }) =>
          ({ id, name, amount, frequency_type, frequency_param, partner_label })
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
        }) =>
          ({ id, name, amount, frequency_type, frequency_param, benefit_x, category_id, linked_account_id, budget_id, is_estimate })
        ) as unknown as Json,
        categories: categories.map(({ id, name, color }) => ({ id, name, color })) as unknown as Json,
        linkedAccounts: linkedAccounts.map(({ id, name, color, owner_partner }) => ({ id, name, color, owner_partner })) as unknown as Json,
      };
      await onSave(notes.trim(), snapshot);
      setNotes('');
      setAddDialogOpen(false);
      toast({ title: 'Snapshot saved' });
    } catch (e: any) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      await onRestore(restoreTarget.data);
      toast({ title: 'Restored', description: `Restored from ${formatTimestamp(restoreTarget.created_at)}` });
    } catch (e: any) {
      toast({ title: 'Error restoring', description: e.message, variant: 'destructive' });
    }
    setRestoreTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onRemove(deleteTarget.id);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const startEditingNotes = (point: RestorePoint) => {
    setEditingNotesId(point.id);
    setEditingNotesValue(point.notes ?? '');
  };

  const cancelEditingNotes = () => {
    setEditingNotesId(null);
    setEditingNotesValue('');
  };

  const commitNotesEdit = useCallback(async () => {
    if (!editingNotesId) return;
    const point = points.find((p) => p.id === editingNotesId);
    const next = editingNotesValue.trim();
    const current = point?.notes?.trim() ?? '';
    if (next === current) {
      cancelEditingNotes();
      return;
    }
    try {
      await onUpdateNotes(editingNotesId, next);
      toast({ title: 'Notes updated' });
    } catch (e: any) {
      toast({ title: 'Error updating notes', description: e.message, variant: 'destructive' });
    }
    cancelEditingNotes();
  }, [editingNotesId, editingNotesValue, onUpdateNotes, points]);

  const columns = useMemo(
    () => [
      restorePointColumnHelper.accessor('created_at', {
        id: 'timestamp',
        header: 'Timestamp',
        size: 240,
        minSize: GRID_MIN_COLUMN_WIDTH,
        cell: ({ row }) => <span className="font-medium">{formatTimestamp(row.original.created_at)}</span>,
      }),
      restorePointColumnHelper.accessor((row) => row.notes ?? '', {
        id: 'notes',
        header: 'Notes',
        size: 420,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { containsEditableInput: true },
        cell: ({ row }) => {
          const point = row.original;
          return editingNotesId === point.id ? (
            <Input
              value={editingNotesValue}
              onChange={(event) => setEditingNotesValue(event.target.value)}
              onBlur={() => { void commitNotesEdit(); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void commitNotesEdit();
                }
                if (event.key === 'Escape') {
                  cancelEditingNotes();
                }
              }}
              autoFocus
              className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => startEditingNotes(point)}
              className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-left text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer hover:border-border"
            >
              {point.notes?.trim() || '—'}
            </button>
          );
        },
      }),
      restorePointColumnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        minSize: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        maxSize: CONFIG_BACKUPS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => {
          const point = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <BackupActionsTrigger />
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
    [commitNotesEdit, editingNotesId, editingNotesValue],
  );

  const table = useReactTable({
    data: points,
    columns,
    defaultColumn: { minSize: GRID_MIN_COLUMN_WIDTH },
    state: { sorting, columnSizing, columnSizingInfo },
    enableColumnResizing: true,
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
            <DataGrid table={table} maxHeight="none" stickyFirstColumn={false} />
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
            <DialogTitle>Create backup</DialogTitle>
            <DialogDescription>Save a snapshot of your current categories, payment methods, incomes, and expenses.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
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
            <Button variant="outline-success" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!restoreTarget} onOpenChange={open => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore snapshot from {restoreTarget ? formatTimestamp(restoreTarget.created_at) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all your current categories, incomes, and expenses with the data from this snapshot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
