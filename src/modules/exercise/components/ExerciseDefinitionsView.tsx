import { forwardRef, useCallback, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type KeyboardEventHandler, type MouseEventHandler, type PointerEventHandler } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import {
  EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS,
  GRID_ACTIONS_COLUMN_ID,
  GRID_FIXED_COLUMNS,
  GRID_MIN_COLUMN_WIDTH,
} from '@/lib/gridColumnWidths';
import {
  formatDistanceMiles,
  formatDurationSeconds,
  formatWeightLbs,
  parseDurationInput,
} from '@/modules/exercise/lib/exercise';
import { ExerciseDefinitionDialog } from '@/modules/exercise/components/ExerciseDefinitionDialog';
import type { ExerciseDefinition, ExerciseDefinitionInput } from '@/modules/exercise/types/exercise';

interface ExerciseDefinitionsViewProps {
  userId?: string;
  definitions: ExerciseDefinition[];
  onAddDefinition: (input: ExerciseDefinitionInput, id?: string) => Promise<void | ExerciseDefinition>;
  onUpdateDefinition: (id: string, input: ExerciseDefinitionInput) => Promise<void>;
  onRemoveDefinition: (id: string) => Promise<void>;
  fullView?: boolean;
}

const columnHelper = createColumnHelper<ExerciseDefinition>();
const EXERCISE_DEFINITIONS_HISTORY_KEY = 'exercise_definitions';
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';

function toDefinitionInput(definition: ExerciseDefinition): ExerciseDefinitionInput {
  return {
    name: definition.name,
    rep_count: definition.rep_count,
    duration_seconds: definition.duration_seconds,
    distance_miles: definition.distance_miles,
    weight_lbs: definition.weight_lbs,
    weight_delta_lbs: definition.weight_delta_lbs,
  };
}

function parseOptionalPositiveInteger(raw: string, label: string): number | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return Math.round(parsed);
}

function parseOptionalPositiveDecimal(raw: string, label: string): number | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return parsed;
}

function parseOptionalNonNegativeDecimal(raw: string, label: string): number | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function formatRepCount(value: number | null): string {
  return value == null ? '' : String(value);
}

function formatDurationCellValue(value: number | null): string {
  return value == null ? '' : formatDurationSeconds(value);
}

function formatDistanceCellValue(value: number | null): string {
  return value == null ? '' : formatDistanceMiles(value);
}

function formatWeightCellValue(value: number | null): string {
  return value == null ? '' : formatWeightLbs(value);
}

type ExerciseFieldKey = keyof Pick<
  ExerciseDefinitionInput,
  'name' | 'rep_count' | 'duration_seconds' | 'distance_miles' | 'weight_lbs' | 'weight_delta_lbs'
>;

type ExerciseActionsTriggerProps = ComponentPropsWithoutRef<typeof Button> & {
  navCol: number;
  ariaLabel: string;
};

const ExerciseActionsTrigger = forwardRef<HTMLButtonElement, ExerciseActionsTriggerProps>(function ExerciseActionsTrigger({
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

export function ExerciseDefinitionsView({
  userId,
  definitions,
  onAddDefinition,
  onUpdateDefinition,
  onRemoveDefinition,
  fullView = false,
}: ExerciseDefinitionsViewProps) {
  const dataGridHistory = useDataGridHistory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [{ id: 'name', desc: false }];
    try {
      const raw = window.localStorage.getItem('exercise_definitions_sorting');
      return raw ? JSON.parse(raw) : [{ id: 'name', desc: false }];
    } catch {
      return [{ id: 'name', desc: false }];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('exercise_definitions_sorting', JSON.stringify(sorting));
  }, [sorting]);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'exercise_definitions',
    defaults: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.exercise_definitions,
  });

  const openForCreate = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const normalizeUpdatedDefinition = useCallback((
    definition: ExerciseDefinition,
    field: ExerciseFieldKey,
    rawValue: string,
  ): ExerciseDefinitionInput => {
    const next = toDefinitionInput(definition);

    if (field === 'name') {
      const name = rawValue.trim();
      if (!name) {
        throw new Error('Exercise Name is required.');
      }
      next.name = name;
    }

    if (field === 'rep_count') {
      next.rep_count = parseOptionalPositiveInteger(rawValue, 'Rep Count');
    }

    if (field === 'duration_seconds') {
      next.duration_seconds = rawValue.trim() ? parseDurationInput(rawValue) : null;
    }

    if (field === 'distance_miles') {
      next.distance_miles = parseOptionalPositiveDecimal(rawValue, 'Distance');
    }

    if (field === 'weight_lbs') {
      next.weight_lbs = parseOptionalPositiveDecimal(rawValue, 'Weight');
      if (next.weight_lbs == null) {
        next.weight_delta_lbs = null;
      }
    }

    if (field === 'weight_delta_lbs') {
      next.weight_delta_lbs = parseOptionalNonNegativeDecimal(rawValue, 'Weight Range');
    }

    if (next.weight_delta_lbs != null && next.weight_lbs == null) {
      throw new Error('A Weight Range requires a base Weight.');
    }

    return next;
  }, []);

  const handleInlineUpdate = useCallback(async (
    definition: ExerciseDefinition,
    field: ExerciseFieldKey,
    rawValue: string,
  ) => {
    try {
      const next = normalizeUpdatedDefinition(definition, field, rawValue);
      await onUpdateDefinition(definition.id, next);
    } catch (error) {
      toast({
        title: 'Could Not Save Exercise',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [normalizeUpdatedDefinition, onUpdateDefinition]);

  const handleSave = async (input: ExerciseDefinitionInput) => {
    setSaving(true);
    const definitionId = crypto.randomUUID();
    const historyEntryId = dataGridHistory?.recordHistoryEntry({
      undo: () => onRemoveDefinition(definitionId),
      redo: () => onAddDefinition(input, definitionId),
      undoFocusTarget: null,
      redoFocusTarget: {
        gridId: EXERCISE_DEFINITIONS_HISTORY_KEY,
        rowId: definitionId,
        col: 0,
      },
    });

    try {
      await onAddDefinition(input, definitionId);
      setDialogOpen(false);
    } catch (error) {
      dataGridHistory?.invalidateHistoryEntry(historyEntryId);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (definition: ExerciseDefinition) => {
    if (!window.confirm(`Delete "${definition.name}"?`)) return;

    const payload = toDefinitionInput(definition);
    const historyEntryId = dataGridHistory?.recordHistoryEntry({
      undo: () => onAddDefinition(payload, definition.id),
      redo: () => onRemoveDefinition(definition.id),
      undoFocusTarget: {
        gridId: EXERCISE_DEFINITIONS_HISTORY_KEY,
        rowId: definition.id,
        col: 0,
      },
      redoFocusTarget: null,
    });

    try {
      await onRemoveDefinition(definition.id);
    } catch (error) {
      dataGridHistory?.invalidateHistoryEntry(historyEntryId);
      toast({
        title: 'Could Not Delete Exercise',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  }, [dataGridHistory, onAddDefinition, onRemoveDefinition]);

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      id: 'name',
      header: 'Name',
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS.name,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.name}
          navCol={0}
          cellId={row.original.id}
          placeholder="Exercise"
          onChange={(value) => handleInlineUpdate(row.original, 'name', value)}
        />
      ),
    }),
    columnHelper.accessor('rep_count', {
      id: 'rep_count',
      header: 'Reps',
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS.rep_count,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={formatRepCount(row.original.rep_count)}
          navCol={1}
          type="number"
          inputMode="numeric"
          className="!text-right"
          placeholder="Reps"
          cellId={row.original.id}
          deleteResetValue=""
          normalizeOnCommit={(value) => value.trim()}
          onChange={(value) => handleInlineUpdate(row.original, 'rep_count', value)}
        />
      ),
    }),
    columnHelper.accessor('duration_seconds', {
      id: 'duration_seconds',
      header: 'Duration',
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS.duration_seconds,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={formatDurationCellValue(row.original.duration_seconds)}
          navCol={2}
          placeholder="mm:ss"
          cellId={row.original.id}
          deleteResetValue=""
          normalizeOnCommit={(value) => value.trim()}
          onChange={(value) => handleInlineUpdate(row.original, 'duration_seconds', value)}
        />
      ),
    }),
    columnHelper.accessor('distance_miles', {
      id: 'distance_miles',
      header: 'Distance (mi)',
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS.distance_miles,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={formatDistanceCellValue(row.original.distance_miles)}
          navCol={3}
          type="number"
          inputMode="decimal"
          className="!text-right"
          placeholder="Miles"
          cellId={row.original.id}
          deleteResetValue=""
          normalizeOnCommit={(value) => value.trim()}
          onChange={(value) => handleInlineUpdate(row.original, 'distance_miles', value)}
        />
      ),
    }),
    columnHelper.accessor('weight_lbs', {
      id: 'weight_lbs',
      header: 'Weight (lb)',
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS.weight_lbs,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={formatWeightCellValue(row.original.weight_lbs)}
          navCol={4}
          type="number"
          inputMode="decimal"
          className="!text-right"
          placeholder="Weight"
          cellId={row.original.id}
          deleteResetValue=""
          normalizeOnCommit={(value) => value.trim()}
          onChange={(value) => handleInlineUpdate(row.original, 'weight_lbs', value)}
        />
      ),
    }),
    columnHelper.accessor('weight_delta_lbs', {
      id: 'weight_delta_lbs',
      header: 'Weight Range (+/- lb)',
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS.weight_delta_lbs,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={formatWeightCellValue(row.original.weight_delta_lbs)}
          navCol={5}
          type="number"
          inputMode="decimal"
          className="!text-right"
          placeholder="Range"
          cellId={row.original.id}
          deleteResetValue=""
          normalizeOnCommit={(value) => value.trim()}
          onChange={(value) => handleInlineUpdate(row.original, 'weight_delta_lbs', value)}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      enableResizing: false,
      size: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
      minSize: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
      maxSize: EXERCISE_DEFINITIONS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
      meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ExerciseActionsTrigger navCol={6} ariaLabel={`Actions for ${row.original.name}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem
              onClick={() => { void handleDelete(row.original); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ], [handleDelete, handleInlineUpdate]);

  const table = useReactTable({
    data: definitions,
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

  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'px-0 pb-2.5';

  return (
    <div className={fullView ? 'flex h-full min-h-0 flex-col' : undefined}>
      <Card className={fullView ? 'max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 border-t-0 border-b-0 md:border-t h-full min-h-0 flex flex-col' : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Exercises</CardTitle>
            <Button
              type="button"
              onClick={openForCreate}
              variant="outline-success"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Add Exercise"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={gridCardContentClassName}>
          <DataGrid
            table={table}
            historyKey={EXERCISE_DEFINITIONS_HISTORY_KEY}
            fullView={fullView}
            maxHeight={fullView ? 'none' : undefined}
            className={fullView ? 'h-full min-h-0' : undefined}
            emptyMessage="No exercises yet."
          />
        </CardContent>
      </Card>

      <ExerciseDefinitionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSave}
        pending={saving}
        definition={null}
        title="Add Exercise"
      />
    </div>
  );
}
