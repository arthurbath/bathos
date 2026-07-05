import { useCallback, useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { format } from 'date-fns';
import { CalendarIcon, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid, GridEditableCell, GridSelectValue, GRID_NULL_PLACEHOLDER, gridMenuTriggerProps, gridNavProps, gridSelectTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { EMPTY_GRID_VIEW_FILTERS, sanitizeSortingState, useGridViewPreferences } from '@/hooks/useGridViewPreferences';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import { GRID_FIXED_COLUMNS, SNAKE_SNAKES_GRID_DEFAULT_WIDTHS } from '@/lib/gridColumnWidths';
import { cn } from '@/lib/utils';
import { HouseholdManagementPanel, type HouseholdMember } from '@/platform/households';
import type { Snake, SnakeHouseholdData, SnakeInput, SnakeSex, SnakeUpdate } from '@/modules/snake/types/snake';

interface SnakeConfigViewProps {
  userId: string;
  snakes: Snake[];
  household: SnakeHouseholdData;
  userEmail: string;
  householdMembers: HouseholdMember[];
  householdMembersLoading: boolean;
  householdMembersError: string | null;
  pendingHouseholdMemberId: string | null;
  rotatingHouseholdInviteCode: boolean;
  leavingHousehold: boolean;
  deletingHousehold: boolean;
  autoOpenAddSnake?: boolean;
  onAddSnake: (input: SnakeInput, id?: string) => Promise<void>;
  onUpdateSnake: (snakeId: string, updates: SnakeUpdate) => Promise<void>;
  onRemoveSnake: (snakeId: string) => Promise<void>;
  onRotateHouseholdInviteCode: () => Promise<void>;
  onRemoveHouseholdMember: (memberUserId: string) => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteHousehold: () => Promise<void>;
}

interface SnakeFormState {
  id: string | null;
  name: string;
  birthday: string;
  species: string;
  morph: string;
  sex: SnakeSex;
  notes: string;
}

const columnHelper = createColumnHelper<Snake>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const SNAKE_ACTIONS_NAV_COL = 6;
const SNAKE_SNAKES_HISTORY_KEY = 'snake_snakes';
const SNAKE_DEFAULT_SORTING: SortingState = [{ id: 'name', desc: false }];
const SEX_OPTIONS: Array<{ value: SnakeSex; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

function emptyFormState(): SnakeFormState {
  return {
    id: null,
    name: '',
    birthday: '',
    species: 'Ball Python',
    morph: '',
    sex: 'unknown',
    notes: '',
  };
}

function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getCalendarMonthForDateInput(value: string): Date {
  const parsed = parseDateInputValue(value);
  if (parsed) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function normalizeRequiredText(value: string, fallback: string, title: string): string {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  toast({ title, variant: 'destructive' });
  return fallback;
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function toSnakeInput(form: SnakeFormState): SnakeInput {
  return {
    name: form.name.trim(),
    birthday: form.birthday,
    species: form.species.trim() || 'Ball Python',
    growth_profile: 'ball_python',
    morph: form.morph,
    sex: form.sex,
    notes: form.notes,
  };
}

function toSnakeInputFromSnake(snake: Snake): SnakeInput {
  return {
    name: snake.name,
    birthday: snake.birthday,
    species: snake.species,
    growth_profile: snake.growth_profile,
    morph: snake.morph,
    sex: snake.sex as SnakeSex,
    notes: snake.notes,
    is_active: snake.is_active,
  };
}

function SnakeDateCell({
  value,
  navCol,
  onChange,
}: {
  value: string;
  navCol: number;
  onChange: (value: string) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();
  const [open, setOpen] = useState(false);
  const parsedDate = parseDateInputValue(value);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => getCalendarMonthForDateInput(value));

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(getCalendarMonthForDateInput(value));
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-grid-focus-only="true"
          {...gridNavProps(ctx, navCol)}
          onKeyDown={(event) => {
            if (ctx?.onCellKeyDown(event)) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setOpen(true);
          }}
          className={cn(
            'inline-flex h-7 w-full items-center justify-start gap-1 rounded-md border border-transparent bg-transparent px-1 text-left text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 hover:border-[hsl(var(--grid-sticky-line))]',
            GRID_CONTROL_FOCUS_CLASS,
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{parsedDate ? format(parsedDate, 'MMM d, yyyy') : GRID_NULL_PLACEHOLDER}</span>
          <CalendarIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
        <Calendar
          mode="single"
          selected={parsedDate}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          onSelect={(date) => {
            if (!date) return;
            const nextValue = toDateInputValue(date);
            if (nextValue !== value) {
              const historyEntryId = ctx?.registerCellHistoryEntry({
                col: navCol,
                undo: () => onChange(value),
                redo: () => onChange(nextValue),
              });
              ctx?.onCellCommit(navCol);
              const maybePendingChange = onChange(nextValue);
              if (maybePendingChange && typeof maybePendingChange === 'object' && 'catch' in maybePendingChange && typeof maybePendingChange.catch === 'function') {
                void maybePendingChange.catch(() => {
                  ctx?.invalidateCellHistoryEntry(historyEntryId);
                });
              }
            }
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function SnakeSexCell({
  value,
  onChange,
}: {
  value: SnakeSex;
  onChange: (value: SnakeSex) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const nextValue = next as SnakeSex;
        const historyEntryId = ctx?.registerCellHistoryEntry({
          col: 4,
          undo: () => onChange(value),
          redo: () => onChange(nextValue),
        });
        ctx?.onCellCommit(4);
        const maybePendingChange = onChange(nextValue);
        if (maybePendingChange && typeof maybePendingChange === 'object' && 'catch' in maybePendingChange && typeof maybePendingChange.catch === 'function') {
          void maybePendingChange.catch(() => {
            ctx?.invalidateCellHistoryEntry(historyEntryId);
          });
        }
      }}
    >
      <SelectTrigger
        className={`h-7 border-transparent bg-transparent px-1 text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 hover:border-[hsl(var(--grid-sticky-line))] ${GRID_CONTROL_FOCUS_CLASS}`}
        {...gridSelectTriggerProps(ctx, 4)}
      >
        <GridSelectValue placeholder="Unknown" />
      </SelectTrigger>
      <SelectContent>
        {SEX_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SnakeActionsCell({
  snake,
  onDelete,
}: {
  snake: Snake;
  onDelete: (snake: Snake) => void;
}) {
  const ctx = useDataGrid();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
          aria-label={`Actions for ${snake.name}`}
          {...gridMenuTriggerProps(ctx, SNAKE_ACTIONS_NAV_COL)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(snake)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SnakeConfigView({
  userId,
  snakes,
  household,
  userEmail,
  householdMembers,
  householdMembersLoading,
  householdMembersError,
  pendingHouseholdMemberId,
  rotatingHouseholdInviteCode,
  leavingHousehold,
  deletingHousehold,
  autoOpenAddSnake = false,
  onAddSnake,
  onUpdateSnake,
  onRemoveSnake,
  onRotateHouseholdInviteCode,
  onRemoveHouseholdMember,
  onLeaveHousehold,
  onDeleteHousehold,
}: SnakeConfigViewProps) {
  const dataGridHistory = useDataGridHistory();
  const { sorting, setSorting } = useGridViewPreferences({
    userId,
    gridKey: 'snake_snakes',
    defaultFilters: EMPTY_GRID_VIEW_FILTERS,
    defaultSorting: SNAKE_DEFAULT_SORTING,
    sanitizeSorting: (raw) => sanitizeSortingState(raw, SNAKE_DEFAULT_SORTING),
    getLegacyPreferences: () => ({
      sorting: (() => {
        try {
          const raw = localStorage.getItem('snake_snakes_sorting');
          return raw ? JSON.parse(raw) : SNAKE_DEFAULT_SORTING;
        } catch {
          return SNAKE_DEFAULT_SORTING;
        }
      })(),
    }),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SnakeFormState>(() => emptyFormState());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Snake | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hasAutoOpenedModal, setHasAutoOpenedModal] = useState(false);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'snake_snakes',
    defaults: SNAKE_SNAKES_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.snake_snakes,
  });

  useEffect(() => {
    if (!dialogOpen) setForm(emptyFormState());
  }, [dialogOpen]);

  useEffect(() => {
    localStorage.setItem('snake_snakes_sorting', JSON.stringify(sorting));
  }, [sorting]);

  const openAddDialog = useCallback(() => {
    setForm(emptyFormState());
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (snakes.length > 0) {
      setHasAutoOpenedModal(false);
    }
  }, [snakes.length]);

  useEffect(() => {
    if (!autoOpenAddSnake) return;
    if (snakes.length !== 0) return;
    if (dialogOpen) return;
    if (hasAutoOpenedModal) return;

    openAddDialog();
    setHasAutoOpenedModal(true);
  }, [autoOpenAddSnake, dialogOpen, hasAutoOpenedModal, openAddDialog, snakes.length]);

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      size: 180,
      minSize: 120,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.name}
          navCol={0}
          normalizeOnCommit={(value) => normalizeRequiredText(value, row.original.name, 'Name is required')}
          onChange={(value) => onUpdateSnake(row.original.id, {
            name: normalizeRequiredText(value, row.original.name, 'Name is required'),
          })}
        />
      ),
    }),
    columnHelper.accessor('birthday', {
      header: 'Birthday',
      size: 140,
      minSize: 120,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <SnakeDateCell
          value={row.original.birthday}
          navCol={1}
          onChange={(value) => onUpdateSnake(row.original.id, { birthday: value })}
        />
      ),
    }),
    columnHelper.accessor('species', {
      header: 'Species',
      size: 160,
      minSize: 120,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.species}
          navCol={2}
          normalizeOnCommit={(value) => normalizeRequiredText(value, row.original.species || 'Ball Python', 'Species is required')}
          onChange={(value) => onUpdateSnake(row.original.id, {
            species: normalizeRequiredText(value, row.original.species || 'Ball Python', 'Species is required'),
          })}
        />
      ),
    }),
    columnHelper.accessor('morph', {
      header: 'Morph',
      size: 160,
      minSize: 120,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.morph ?? ''}
          navCol={3}
          deleteResetValue=""
          onChange={(value) => onUpdateSnake(row.original.id, { morph: normalizeOptionalText(value) })}
        />
      ),
    }),
    columnHelper.accessor('sex', {
      header: 'Sex',
      size: 120,
      minSize: 100,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <SnakeSexCell
          value={row.original.sex as SnakeSex}
          onChange={(value) => onUpdateSnake(row.original.id, { sex: value })}
        />
      ),
    }),
    columnHelper.accessor('notes', {
      header: 'Notes',
      size: 260,
      minSize: 160,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.notes ?? ''}
          navCol={5}
          deleteResetValue=""
          onChange={(value) => onUpdateSnake(row.original.id, { notes: normalizeOptionalText(value) })}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      enableResizing: false,
      size: 40,
      minSize: 40,
      maxSize: 40,
      meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
      cell: ({ row }) => (
        <SnakeActionsCell
          snake={row.original}
          onDelete={setDeleteTarget}
        />
      ),
    }),
  ], [onUpdateSnake]);

  const table = useReactTable({
    data: snakes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnSizing, columnSizingInfo },
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    enableColumnResizing: columnResizingEnabled,
    enableSortingRemoval: false,
    columnResizeMode: 'onChange',
  });

  const canSave = form.name.trim().length > 0 && form.birthday.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const snakeId = crypto.randomUUID();
      const payload = {
        ...toSnakeInput(form),
        is_active: snakes.length === 0,
      };
      dataGridHistory?.recordHistoryEntry({
        undo: () => onRemoveSnake(snakeId),
        redo: () => onAddSnake(payload, snakeId),
        undoFocusTarget: null,
        redoFocusTarget: {
          gridId: SNAKE_SNAKES_HISTORY_KEY,
          rowId: snakeId,
          col: 0,
        },
      });
      await onAddSnake(payload, snakeId);
      setDialogOpen(false);
      toast({ title: 'Snake added' });
    } catch (error) {
      toast({
        title: 'Failed to add snake',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const restorePayload = toSnakeInputFromSnake(deleteTarget);
      dataGridHistory?.recordHistoryEntry({
        undo: () => onAddSnake(restorePayload, deleteTarget.id),
        redo: () => onRemoveSnake(deleteTarget.id),
        undoFocusTarget: {
          gridId: SNAKE_SNAKES_HISTORY_KEY,
          rowId: deleteTarget.id,
          col: 0,
        },
        redoFocusTarget: null,
      });
      await onRemoveSnake(deleteTarget.id);
      setDeleteTarget(null);
      toast({ title: 'Snake deleted' });
    } catch (error) {
      toast({
        title: 'Failed to delete snake',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Snakes</CardTitle>
          <Button
            type="button"
            variant="outline-success"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Add snake"
            onClick={openAddDialog}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden px-0 pb-2.5">
          <div className="min-w-0 overflow-hidden">
            <DataGrid
              table={table}
              historyKey={SNAKE_SNAKES_HISTORY_KEY}
              maxHeight="none"
              emptyMessage={snakes.length === 0 ? 'No snakes yet.' : 'No snakes'}
            />
          </div>
        </CardContent>
      </Card>

      <HouseholdManagementPanel
        moduleName="Snake"
        inviteCode={household.inviteCode}
        userEmail={userEmail}
        members={householdMembers}
        membersLoading={householdMembersLoading}
        membersError={householdMembersError}
        pendingMemberId={pendingHouseholdMemberId}
        rotatingInviteCode={rotatingHouseholdInviteCode}
        leavingHousehold={leavingHousehold}
        deletingHousehold={deletingHousehold}
        onRotateInviteCode={onRotateHouseholdInviteCode}
        onRemoveMember={onRemoveHouseholdMember}
        onLeaveHousehold={onLeaveHousehold}
        onDeleteHousehold={onDeleteHousehold}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (saving) return;
          setDialogOpen(open);
        }}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Snake</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <DataGridAddFormLabel htmlFor="snake-name" required>Name</DataGridAddFormLabel>
              <Input
                id="snake-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <DataGridAddFormLabel htmlFor="snake-birthday" required>Birthday</DataGridAddFormLabel>
                <Input
                  id="snake-birthday"
                  type="date"
                  value={form.birthday}
                  onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <DataGridAddFormLabel htmlFor="snake-species">Species</DataGridAddFormLabel>
                <Input
                  id="snake-species"
                  value={form.species}
                  onChange={(event) => setForm((current) => ({ ...current, species: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <DataGridAddFormLabel htmlFor="snake-morph">Morph</DataGridAddFormLabel>
                <Input
                  id="snake-morph"
                  value={form.morph}
                  onChange={(event) => setForm((current) => ({ ...current, morph: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <DataGridAddFormLabel htmlFor="snake-sex">Sex</DataGridAddFormLabel>
                <Select
                  value={form.sex}
                  onValueChange={(value) => setForm((current) => ({ ...current, sex: value as SnakeSex }))}
                >
                  <SelectTrigger id="snake-sex">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <DataGridAddFormLabel htmlFor="snake-notes">Notes</DataGridAddFormLabel>
              <Textarea
                id="snake-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Snake</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {deleteTarget?.name ?? 'this snake'} and its weight records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
