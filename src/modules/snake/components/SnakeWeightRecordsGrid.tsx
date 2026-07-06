import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { format } from 'date-fns';
import { CalendarIcon, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, gridNavProps, useDataGrid } from '@/components/ui/data-grid';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { EMPTY_GRID_VIEW_FILTERS, sanitizeSortingState, useGridViewPreferences } from '@/hooks/useGridViewPreferences';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import { PersistentTooltipText } from '@/components/ui/tooltip';
import { GRID_FIXED_COLUMNS, SNAKE_WEIGHT_RECORDS_GRID_DEFAULT_WIDTHS } from '@/lib/gridColumnWidths';
import { cn } from '@/lib/utils';
import { deriveSnakeWeightRecords, findGrowthExpectationRange } from '@/modules/snake/lib/growthMath';
import type {
  DerivedSnakeWeightRecord,
  Snake,
  SnakeGrowthExpectationRange,
  SnakeWeightRecord,
  SnakeWeightRecordInput,
  SnakeWeightRecordUpdate,
} from '@/modules/snake/types/snake';

interface SnakeWeightRecordsGridProps {
  userId: string;
  snake: Snake;
  records: SnakeWeightRecord[];
  expectationRanges: SnakeGrowthExpectationRange[];
  loading: boolean;
  fullView?: boolean;
  onAddWeightRecord: (input: SnakeWeightRecordInput, id?: string) => Promise<void>;
  onUpdateWeightRecord: (recordId: string, updates: SnakeWeightRecordUpdate) => Promise<void>;
  onDeleteWeightRecord: (recordId: string) => Promise<void>;
}

interface WeightRecordFormState {
  recordedOn: string;
  weightGrams: string;
}

const columnHelper = createColumnHelper<DerivedSnakeWeightRecord>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const WEIGHT_RECORDS_HISTORY_KEY = 'snake_weight_records';
const WEIGHT_RECORDS_ACTIONS_NAV_COL = 8;
const WEIGHT_RECORDS_DEFAULT_SORTING: SortingState = [{ id: 'recorded_on', desc: true }];

function emptyFormState(): WeightRecordFormState {
  return {
    recordedOn: '',
    weightGrams: '',
  };
}

function parseWeightGrams(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeWeightInput(value: string, fallback: number): string {
  const parsed = parseWeightGrams(value);
  if (parsed === null) {
    toast({ title: 'Weight must be greater than 0', variant: 'destructive' });
    return String(fallback);
  }
  return String(parsed);
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

function formatNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '';
  return digits > 0 ? value.toFixed(digits) : String(value);
}

function formatThresholdNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatAgeRange(range: SnakeGrowthExpectationRange): string {
  const lower = formatThresholdNumber(range.age_lower_months);
  if (range.age_upper_months === null) return `${lower}+ mo`;
  return `${lower}-${formatThresholdNumber(range.age_upper_months)} mo`;
}

function formatExpectedGrowthRange(range: SnakeGrowthExpectationRange): string {
  return `${formatThresholdNumber(range.growth_lower_grams_per_month)}-${formatThresholdNumber(range.growth_upper_grams_per_month)} g/mo`;
}

function GrowthStatusThresholdTooltip({
  record,
  ranges,
  profile,
}: {
  record: DerivedSnakeWeightRecord;
  ranges: SnakeGrowthExpectationRange[];
  profile: string;
}) {
  const status = record.growthStatus;
  if (!status) return null;

  const profileRanges = ranges
    .filter((range) => range.profile === profile)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeRange = findGrowthExpectationRange(profileRanges, profile, record.ageMonths);

  return (
    <PersistentTooltipText
      side="left"
      align="center"
      triggerClassName="max-w-full truncate"
      contentClassName="[--tooltip-content-max-width:520px] p-0 text-xs"
      content={(
        <table className="min-w-[20rem] border-collapse text-left tabular-nums">
          <thead>
            <tr className="border-b border-[hsl(var(--tooltip-border))]">
              <th className="px-3 py-1.5 font-medium">Age</th>
              <th className="px-3 py-1.5 font-medium">Expected Growth</th>
            </tr>
          </thead>
          <tbody>
            {profileRanges.map((range) => {
              const isActive = activeRange?.id === range.id;
              return (
                <tr key={range.id} className={isActive ? 'font-bold' : undefined}>
                  <td className="px-3 py-1.5">{formatAgeRange(range)}</td>
                  <td className="px-3 py-1.5">{formatExpectedGrowthRange(range)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    >
      {status}
    </PersistentTooltipText>
  );
}

function toWeightRecordInput(form: WeightRecordFormState): SnakeWeightRecordInput | null {
  const weightGrams = parseWeightGrams(form.weightGrams);
  if (!form.recordedOn || weightGrams === null) return null;

  return {
    recorded_on: form.recordedOn,
    weight_grams: weightGrams,
  };
}

function toWeightRecordInputFromRecord(record: DerivedSnakeWeightRecord): SnakeWeightRecordInput {
  return {
    recorded_on: record.recorded_on,
    weight_grams: record.weight_grams,
  };
}

function WeightRecordDateCell({
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
          <span className="truncate">
            {parsedDate ? format(parsedDate, 'MMM d, yyyy') : (value || 'Pick a date')}
          </span>
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

function WeightRecordActionsCell({
  record,
  onDelete,
}: {
  record: DerivedSnakeWeightRecord;
  onDelete: (record: DerivedSnakeWeightRecord) => void;
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
          aria-label={`Actions for ${record.recorded_on}`}
          {...gridMenuTriggerProps(ctx, WEIGHT_RECORDS_ACTIONS_NAV_COL)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(record)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SnakeWeightRecordsGrid({
  userId,
  snake,
  records,
  expectationRanges,
  loading,
  fullView = false,
  onAddWeightRecord,
  onUpdateWeightRecord,
  onDeleteWeightRecord,
}: SnakeWeightRecordsGridProps) {
  const dataGridHistory = useDataGridHistory();
  const { sorting, setSorting } = useGridViewPreferences({
    userId,
    gridKey: 'snake_weight_records',
    defaultFilters: EMPTY_GRID_VIEW_FILTERS,
    defaultSorting: WEIGHT_RECORDS_DEFAULT_SORTING,
    sanitizeSorting: (raw) => sanitizeSortingState(raw, WEIGHT_RECORDS_DEFAULT_SORTING),
    getLegacyPreferences: () => ({
      sorting: (() => {
        try {
          const raw = localStorage.getItem('snake_weight_records_sorting');
          return raw ? JSON.parse(raw) : WEIGHT_RECORDS_DEFAULT_SORTING;
        } catch {
          return WEIGHT_RECORDS_DEFAULT_SORTING;
        }
      })(),
    }),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<WeightRecordFormState>(() => emptyFormState());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DerivedSnakeWeightRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'snake_weight_records',
    defaults: SNAKE_WEIGHT_RECORDS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.snake_weight_records,
  });

  const derivedRecords = useMemo(
    () => deriveSnakeWeightRecords({ snake, records, expectationRanges }),
    [expectationRanges, records, snake],
  );

  useEffect(() => {
    localStorage.setItem('snake_weight_records_sorting', JSON.stringify(sorting));
  }, [sorting]);

  const openAddDialog = () => {
    setForm(emptyFormState());
    setDialogOpen(true);
  };

  const columns = useMemo(() => [
    columnHelper.accessor('recorded_on', {
      header: 'Date',
      size: 130,
      minSize: 100,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <WeightRecordDateCell
          value={row.original.recorded_on}
          navCol={0}
          onChange={(value) => onUpdateWeightRecord(row.original.id, { recorded_on: value })}
        />
      ),
    }),
    columnHelper.accessor('weight_grams', {
      header: 'Weight (g)',
      size: 110,
      minSize: 100,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.weight_grams}
          navCol={1}
          type="number"
          inputMode="numeric"
          numberDisplayFormat="plain"
          normalizeOnCommit={(value) => normalizeWeightInput(value, row.original.weight_grams)}
          onChange={(value) => {
            const weightGrams = parseWeightGrams(value) ?? row.original.weight_grams;
            return onUpdateWeightRecord(row.original.id, { weight_grams: weightGrams });
          }}
        />
      ),
    }),
    columnHelper.accessor('changeGrams', {
      id: 'change_grams',
      header: 'Change (g)',
      size: 110,
      minSize: 100,
      cell: ({ row }) => formatNumber(row.original.changeGrams),
    }),
    columnHelper.accessor('changeGramsPerMonth', {
      id: 'change_grams_per_month',
      header: 'Change (g/mo)',
      size: 130,
      minSize: 120,
      cell: ({ row }) => formatNumber(row.original.changeGramsPerMonth, 2),
    }),
    columnHelper.accessor('ageMonths', {
      id: 'age_months',
      header: 'Age (mo)',
      size: 130,
      minSize: 110,
      cell: ({ row }) => formatNumber(row.original.ageMonths, 2),
    }),
    columnHelper.accessor('growthExpectationLowerGramsPerMonth', {
      id: 'expectation_lower',
      header: 'Expected Low (g)',
      size: 160,
      minSize: 120,
      cell: ({ row }) => formatNumber(row.original.growthExpectationLowerGramsPerMonth),
    }),
    columnHelper.accessor('growthExpectationUpperGramsPerMonth', {
      id: 'expectation_upper',
      header: 'Expected High (g)',
      size: 160,
      minSize: 120,
      cell: ({ row }) => formatNumber(row.original.growthExpectationUpperGramsPerMonth),
    }),
    columnHelper.accessor('growthStatus', {
      id: 'growth_status',
      header: 'Growth Status',
      size: 240,
      minSize: 180,
      cell: ({ row }) => (
        <GrowthStatusThresholdTooltip
          record={row.original}
          ranges={expectationRanges}
          profile={snake.growth_profile}
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
        <WeightRecordActionsCell
          record={row.original}
          onDelete={setDeleteTarget}
        />
      ),
    }),
  ], [expectationRanges, onUpdateWeightRecord, snake.growth_profile]);

  const table = useReactTable({
    data: derivedRecords,
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

  const input = toWeightRecordInput(form);
  const canSave = input !== null;

  const handleSave = async () => {
    if (!input) return;

    setSaving(true);
    try {
      const recordId = crypto.randomUUID();
      dataGridHistory?.recordHistoryEntry({
        undo: () => onDeleteWeightRecord(recordId),
        redo: () => onAddWeightRecord(input, recordId),
        undoFocusTarget: null,
        redoFocusTarget: {
          gridId: WEIGHT_RECORDS_HISTORY_KEY,
          rowId: recordId,
          col: 0,
        },
      });
      await onAddWeightRecord(input, recordId);
      setDialogOpen(false);
      toast({ title: 'Weight record added' });
    } catch (error) {
      toast({
        title: 'Failed to add weight record',
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
      const restorePayload = toWeightRecordInputFromRecord(deleteTarget);
      dataGridHistory?.recordHistoryEntry({
        undo: () => onAddWeightRecord(restorePayload, deleteTarget.id),
        redo: () => onDeleteWeightRecord(deleteTarget.id),
        undoFocusTarget: {
          gridId: WEIGHT_RECORDS_HISTORY_KEY,
          rowId: deleteTarget.id,
          col: 0,
        },
        redoFocusTarget: null,
      });
      await onDeleteWeightRecord(deleteTarget.id);
      setDeleteTarget(null);
      toast({ title: 'Weight record deleted' });
    } catch (error) {
      toast({
        title: 'Failed to delete weight record',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'min-w-0 overflow-hidden px-0 pb-2.5';

  return (
    <>
      <Card className={fullView ? 'max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 h-full min-h-0 flex flex-col border-t-0 border-b-0 md:border-t' : 'min-w-0'}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Weight Records</CardTitle>
          <Button
            type="button"
            variant="outline-success"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Add weight record"
            onClick={openAddDialog}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className={gridCardContentClassName}>
          <DataGrid
            table={table}
            historyKey={WEIGHT_RECORDS_HISTORY_KEY}
            fullView={fullView}
            maxHeight="none"
            className={fullView ? 'h-full min-h-0' : undefined}
            emptyMessage={loading ? 'Loading weight records...' : 'No weight records yet.'}
          />
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (saving) return;
          setDialogOpen(open);
        }}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Weight Record</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <DataGridAddFormLabel htmlFor="snake-weight-date" required>Date</DataGridAddFormLabel>
                <DatePickerField
                  id="snake-weight-date"
                  value={form.recordedOn}
                  onValueChange={(recordedOn) => setForm((current) => ({ ...current, recordedOn }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <DataGridAddFormLabel htmlFor="snake-weight-grams" required>Weight (g)</DataGridAddFormLabel>
                <Input
                  id="snake-weight-grams"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={form.weightGrams}
                  onChange={(event) => setForm((current) => ({ ...current, weightGrams: event.target.value }))}
                />
              </div>
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
            <AlertDialogTitle>Delete Weight Record</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the {deleteTarget?.recorded_on ?? 'selected'} weigh-in for {snake.name}.
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
    </>
  );
}
