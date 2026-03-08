import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { DataGridAddFormAffixInput } from '@/components/ui/data-grid-add-form-affix-input';
import { Plus, Trash2, MoreHorizontal, Filter, FilterX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { FREQUENCY_OPTIONS, toMonthly, frequencyLabels, needsParam } from '@/lib/frequency';
import {
  DataGrid,
  GridEditableCell,
  GridCurrencyCell,
  GridCheckboxCell,
  GridSelectValue,
  gridMenuTriggerProps,
  gridNavProps,
  gridSelectTriggerProps,
  useDataGrid,
  GRID_HEADER_TONE_CLASS,
  GRID_READONLY_TEXT_CLASS,
} from '@/components/ui/data-grid';
import { PersistentTooltipText } from '@/components/ui/tooltip';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { GRID_FIXED_COLUMNS, GRID_MIN_COLUMN_WIDTH, INCOMES_GRID_DEFAULT_WIDTHS } from '@/lib/gridColumnWidths';
import type { FrequencyType } from '@/types/fairshare';
import type { Income } from '@/hooks/useIncomes';
import {
  convertAverageRecordsForValueType,
  DEFAULT_CURRENT_PERIOD_HANDLING,
  enforceIncomeTypeInvariants,
  getAveragedFrequencyLabel,
  seedAverageRecordsFromSimpleAmount,
  sortAverageRecordsForEditor,
  type BudgetAverageRecord,
  type BudgetCurrentPeriodHandling,
  type BudgetValueType,
} from '@/lib/budgetAveraging';
import { AverageRecordsEditor } from '@/components/AverageRecordsEditor';
import { useIsMobile } from '@/hooks/use-mobile';

type NewIncomeDraft = Omit<Income, 'id' | 'household_id'>;
type AveragedValueType = Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>;

const VALUE_TYPE_OPTIONS: { value: BudgetValueType; label: string; description: string }[] = [
  {
    value: 'simple',
    label: 'Simple',
    description: 'Single amount with a standard frequency.',
  },
  {
    value: 'monthly_averaged',
    label: 'Monthly Averaged',
    description: 'Average from one or more monthly records.',
  },
  {
    value: 'yearly_averaged',
    label: 'Yearly Averaged',
    description: 'Average from one or more yearly records.',
  },
];

const createDefaultIncomeDraft = (): NewIncomeDraft => ({
  name: '',
  amount: 0,
  partner_label: 'X',
  frequency_type: 'monthly',
  frequency_param: null,
  is_estimate: false,
  value_type: 'simple',
  current_period_handling: DEFAULT_CURRENT_PERIOD_HANDLING,
  average_records: [],
});

export function applyNewIncomeTypeToDraft(
  previous: NewIncomeDraft,
  nextType: BudgetValueType,
  currentDate: Date = new Date(),
): NewIncomeDraft {
  if (previous.value_type === nextType) return previous;
  if (nextType === 'simple') {
    return {
      ...previous,
      value_type: nextType,
      current_period_handling: DEFAULT_CURRENT_PERIOD_HANDLING,
      average_records: [],
    };
  }

  const targetType = nextType as AveragedValueType;
  const convertedRecords = previous.value_type === 'simple'
    ? []
    : convertAverageRecordsForValueType(previous.average_records, previous.value_type, targetType);
  const seededRecords = convertedRecords.length > 0
    ? convertedRecords
    : seedAverageRecordsFromSimpleAmount(targetType, 0, currentDate);

  return {
    ...previous,
    value_type: targetType,
    current_period_handling: previous.current_period_handling ?? DEFAULT_CURRENT_PERIOD_HANDLING,
    average_records: seededRecords,
  };
}

interface IncomesTabProps {
  incomes: Income[];
  partnerX: string;
  partnerY: string;
  userId?: string;
  pendingById?: Record<string, boolean>;
  wageGapAdjustmentEnabled?: boolean;
  onAdd: (income: Omit<Income, 'id' | 'household_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Income, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  fullView?: boolean;
}

const columnHelper = createColumnHelper<Income>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const INCOME_ACTIONS_NAV_COL = 6;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function normalizeNameFilterValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesNameFilter(name: string, filterValue: string) {
  const normalizedFilter = normalizeNameFilterValue(filterValue);
  return normalizedFilter.length === 0 || name.toLocaleLowerCase().includes(normalizedFilter);
}

function PartnerCell({
  value,
  partnerX,
  partnerY,
  onChange,
  disabled = false,
}: {
  value: string;
  partnerX: string;
  partnerY: string;
  onChange: (v: string) => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const ctx = useDataGrid();
  return (
    <Select value={value} onValueChange={v => {
      ctx?.onCellCommit(1);
      onChange(v);
    }} disabled={disabled}>
      <SelectTrigger
        disabled={disabled}
        className={`h-7 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
        {...gridSelectTriggerProps(ctx, 1, { disabled })}
      >
        <GridSelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="X">{partnerX}</SelectItem>
        <SelectItem value="Y">{partnerY}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FrequencyCell({
  income,
  onChange,
  disabled = false,
}: {
  income: Income;
  onChange: (field: string, v: string) => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const ctx = useDataGrid();
  if (income.value_type !== 'simple') {
    return <span className={`block px-1 text-xs ${GRID_READONLY_TEXT_CLASS}`}>{getAveragedFrequencyLabel(income.value_type)}</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={income.frequency_type} onValueChange={v => {
        ctx?.onCellCommit(4);
        onChange('frequency_type', v);
      }} disabled={disabled}>
        <SelectTrigger
          disabled={disabled}
          className={`h-7 min-w-0 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
          {...gridSelectTriggerProps(ctx, 4, { disabled })}
        >
          <GridSelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCY_OPTIONS.map(f => <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>)}
        </SelectContent>
      </Select>
      {needsParam(income.frequency_type) && (
        <GridEditableCell value={income.frequency_param ?? ''} onChange={v => onChange('frequency_param', v)} type="number" navCol={5} placeholder="X" className="text-left w-8 shrink-0" disabled={disabled} deleteResetValue="" />
      )}
    </div>
  );
}

function EstimateCell({
  income,
  onToggle,
  disabled = false,
}: {
  income: Income;
  onToggle: (next: boolean) => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const isAveraged = income.value_type !== 'simple';
  return (
    <GridCheckboxCell
      checked={isAveraged ? true : income.is_estimate}
      onChange={next => {
        if (isAveraged) return;
        return onToggle(next);
      }}
      navCol={3}
      disabled={disabled || isAveraged}
      deleteResetChecked={false}
      className={isAveraged ? 'ml-1 opacity-60' : 'ml-1 hover:border-[hsl(var(--grid-sticky-line))]'}
    />
  );
}

function AveragedAmountCell({
  income,
  onEdit,
  disabled = false,
}: {
  income: Income;
  onEdit: () => void;
  disabled?: boolean;
}) {
  const ctx = useDataGrid();
  return (
    <div className="relative w-full min-w-[60px]">
      <span className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-normal ${GRID_READONLY_TEXT_CLASS}`}>$</span>
      <button
        type="button"
        disabled={disabled}
        data-grid-focus-only="true"
        className={`h-7 w-full rounded-md border border-transparent bg-transparent pl-4 pr-2 text-right tabular-nums text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 hover:border-[hsl(var(--grid-sticky-line))] ${GRID_CONTROL_FOCUS_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={onEdit}
        {...gridNavProps(ctx, 2)}
        aria-label={`Edit averaged records for ${income.name}`}
      >
        {Math.round(income.amount)}
      </button>
    </div>
  );
}

function IncomeActionsCell({
  income,
  onRemove,
  onConvert,
  disabled = false,
}: {
  income: Income;
  onRemove: (id: string) => void;
  onConvert: (income: Income, targetType: BudgetValueType) => void;
  disabled?: boolean;
}) {
  const ctx = useDataGrid();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            type="button"
            disabled={disabled}
            className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
            aria-label={`Actions for ${income.name}`}
            {...gridMenuTriggerProps(ctx, INCOME_ACTIONS_NAV_COL)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          {income.value_type !== 'simple' && (
            <DropdownMenuItem onClick={() => onConvert(income, 'simple')}>
              Convert to Simple Income
            </DropdownMenuItem>
          )}
          {income.value_type !== 'monthly_averaged' && (
            <DropdownMenuItem onClick={() => onConvert(income, 'monthly_averaged')}>
              Convert to Monthly Avg Income
            </DropdownMenuItem>
          )}
          {income.value_type !== 'yearly_averaged' && (
            <DropdownMenuItem onClick={() => onConvert(income, 'yearly_averaged')}>
              Convert to Yearly Avg Income
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setConfirmOpen(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete income</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete &ldquo;{income.name}&rdquo;? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onRemove(income.id)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function IncomesTab({
  incomes,
  partnerX,
  partnerY,
  userId,
  pendingById = {},
  wageGapAdjustmentEnabled = false,
  onAdd,
  onUpdate,
  onRemove,
  fullView = false,
}: IncomesTabProps) {
  const isMobile = useIsMobile();
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [newIncome, setNewIncome] = useState<NewIncomeDraft>(createDefaultIncomeDraft);
  const [filterName, setFilterName] = useState(() => localStorage.getItem('incomes_filterName') ?? '');
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [draftFilterName, setDraftFilterName] = useState('');

  const [averageEditorState, setAverageEditorState] = useState<{
    income: Income;
    targetValueType: AveragedValueType;
    currentPeriodHandling: BudgetCurrentPeriodHandling;
    records: BudgetAverageRecord[];
    title: string;
  } | null>(null);
  const [savingAverageEditor, setSavingAverageEditor] = useState(false);

  const [convertToSimpleState, setConvertToSimpleState] = useState<{
    income: Income;
    amount: number;
    frequency_type: FrequencyType;
  } | null>(null);
  const [savingConvertToSimple, setSavingConvertToSimple] = useState(false);

  const [sorting, setSorting] = useState<SortingState>(() => {
    try { const s = localStorage.getItem('incomes_sorting'); return s ? JSON.parse(s) : [{ id: 'name', desc: false }]; }
    catch { return [{ id: 'name', desc: false }]; }
  });
  useEffect(() => { localStorage.setItem('incomes_filterName', filterName); }, [filterName]);
  useEffect(() => { localStorage.setItem('incomes_sorting', JSON.stringify(sorting)); }, [sorting]);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'incomes',
    defaults: INCOMES_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.incomes,
  });

  const openAddIncomeModal = () => {
    setNewIncome(createDefaultIncomeDraft());
    setAddIncomeOpen(true);
  };
  const hasNameFilter = normalizeNameFilterValue(filterName).length > 0;
  const filteredIncomes = useMemo(
    () => incomes.filter((income) => matchesNameFilter(income.name, filterName)),
    [filterName, incomes],
  );

  const openViewControlsModal = () => {
    setDraftFilterName(filterName);
    setViewControlsOpen(true);
  };

  const applyViewControls = () => {
    setFilterName(draftFilterName);
    setViewControlsOpen(false);
  };

  const clearViewControls = () => {
    setFilterName('');
  };

  const openAverageEditor = (
    income: Income,
    targetValueType: AveragedValueType,
    currentPeriodHandling: BudgetCurrentPeriodHandling,
    records: BudgetAverageRecord[],
    title: string,
  ) => {
    setAverageEditorState({
      income,
      targetValueType,
      currentPeriodHandling,
      records: sortAverageRecordsForEditor(records),
      title,
    });
  };

  const handleNewIncomeTypeChange = (nextType: BudgetValueType) => {
    setNewIncome((previous) => applyNewIncomeTypeToDraft(previous, nextType));
  };

  const handleSaveIncome = async () => {
    if (savingIncome) return;
    setSavingIncome(true);
    try {
      let payload: NewIncomeDraft;
      if (newIncome.value_type === 'simple') {
        payload = {
          ...newIncome,
          frequency_param: needsParam(newIncome.frequency_type) ? newIncome.frequency_param : null,
          average_records: [],
        };
      } else {
        const averagedPayload = enforceIncomeTypeInvariants(newIncome.value_type, {
          amount: newIncome.amount,
          frequency_type: newIncome.frequency_type,
          frequency_param: newIncome.frequency_param,
          is_estimate: newIncome.is_estimate,
          current_period_handling: newIncome.current_period_handling,
          average_records: newIncome.average_records,
        });
        payload = {
          ...newIncome,
          ...averagedPayload,
        };
      }
      const isVisibleInGrid = matchesNameFilter(payload.name, filterName);
      await onAdd(payload);

      setAddIncomeOpen(false);
      setNewIncome(createDefaultIncomeDraft());
      if (!isVisibleInGrid) {
        toast({
          title: 'Income added but hidden by filters',
          description: 'The income was added, but it is not visible because of the current filters.',
        });
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
    setSavingIncome(false);
  };

  const handleUpdate = (id: string, field: string, value: string) => {
    const updates: Record<string, unknown> = {};
    if (field === 'name') updates.name = value;
    else if (field === 'amount') updates.amount = Number(value) || 0;
    else if (field === 'frequency_param') updates.frequency_param = value ? Number(value) : null;
    else updates[field] = value;
    return onUpdate(id, updates as Partial<Omit<Income, 'id' | 'household_id'>>).catch((error: unknown) => {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
      throw error;
    });
  };

  const handleToggleEstimate = (id: string, next: boolean) => {
    return onUpdate(id, { is_estimate: next }).catch((error: unknown) => {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
      throw error;
    });
  };

  const handleRemove = async (id: string) => {
    try { await onRemove(id); } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleConvert = (income: Income, targetType: BudgetValueType) => {
    if (targetType === income.value_type) return;

    if (targetType === 'simple') {
      const amount = income.amount;
      const frequency_type: FrequencyType = income.value_type === 'monthly_averaged' ? 'monthly' : 'annual';
      setConvertToSimpleState({ income, amount, frequency_type });
      return;
    }

    if (income.value_type === 'simple') {
      const records = seedAverageRecordsFromSimpleAmount(targetType, income.amount);
      openAverageEditor(
        income,
        targetType,
        DEFAULT_CURRENT_PERIOD_HANDLING,
        records,
        `Convert ${income.name} to ${targetType === 'monthly_averaged' ? 'Monthly Averaged' : 'Yearly Averaged'} Income`,
      );
      return;
    }

    const records = convertAverageRecordsForValueType(income.average_records, income.value_type, targetType);
    openAverageEditor(
      income,
      targetType,
      income.current_period_handling,
      records,
      `Convert ${income.name} to ${targetType === 'monthly_averaged' ? 'Monthly Averaged' : 'Yearly Averaged'} Income`,
    );
  };

  const handleSaveAverageEditor = async () => {
    if (!averageEditorState || savingAverageEditor) return;
    setSavingAverageEditor(true);

    const payload = enforceIncomeTypeInvariants(averageEditorState.targetValueType, {
      amount: averageEditorState.income.amount,
      frequency_type: averageEditorState.income.frequency_type,
      frequency_param: averageEditorState.income.frequency_param,
      is_estimate: averageEditorState.income.is_estimate,
      current_period_handling: averageEditorState.currentPeriodHandling,
      average_records: averageEditorState.records,
    });

    try {
      await onUpdate(averageEditorState.income.id, payload);
      setAverageEditorState(null);
    } catch (error: unknown) {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
    }

    setSavingAverageEditor(false);
  };

  const handleConfirmConvertToSimple = async () => {
    if (!convertToSimpleState || savingConvertToSimple) return;
    setSavingConvertToSimple(true);

    try {
      await onUpdate(convertToSimpleState.income.id, {
        value_type: 'simple',
        average_records: [],
        amount: convertToSimpleState.amount,
        frequency_type: convertToSimpleState.frequency_type,
        frequency_param: null,
        is_estimate: true,
        current_period_handling: DEFAULT_CURRENT_PERIOD_HANDLING,
      });
      setConvertToSimpleState(null);
    } catch (error: unknown) {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
    }

    setSavingConvertToSimple(false);
  };

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      id: 'name',
      header: 'Name',
      size: INCOMES_GRID_DEFAULT_WIDTHS.name,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => <GridEditableCell value={row.original.name} onChange={v => handleUpdate(row.original.id, 'name', v)} navCol={0} disabled={!!pendingById[row.original.id]} deleteResetValue="" />,
    }),
    columnHelper.accessor('partner_label', {
      id: 'partner_label',
      header: 'Partner',
      size: INCOMES_GRID_DEFAULT_WIDTHS.partner_label,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => <PartnerCell value={row.original.partner_label} partnerX={partnerX} partnerY={partnerY} onChange={v => handleUpdate(row.original.id, 'partner_label', v)} disabled={!!pendingById[row.original.id]} />,
    }),
    columnHelper.accessor('amount', {
      id: 'amount',
      header: 'Amount',
      size: INCOMES_GRID_DEFAULT_WIDTHS.amount,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', containsEditableInput: true },
      cell: ({ row }) => {
        if (row.original.value_type === 'simple') {
          return <GridCurrencyCell value={Number(row.original.amount)} onChange={v => handleUpdate(row.original.id, 'amount', v)} navCol={2} disabled={!!pendingById[row.original.id]} deleteResetValue="0" />;
        }

        return (
          <AveragedAmountCell
            income={row.original}
            onEdit={() => openAverageEditor(
              row.original,
              row.original.value_type as AveragedValueType,
              row.original.current_period_handling,
              row.original.average_records,
              `Edit ${row.original.value_type === 'monthly_averaged' ? 'Monthly' : 'Yearly'} Records`,
            )}
            disabled={!!pendingById[row.original.id]}
          />
        );
      },
    }),
    columnHelper.accessor('is_estimate', {
      id: 'estimate',
      header: () => (
        <PersistentTooltipText side="bottom" content="Estimated means this value was manually marked as estimated or derived from averaging multiple records.">Est</PersistentTooltipText>
      ),
      size: INCOMES_GRID_DEFAULT_WIDTHS.estimate,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-center', cellClassName: 'text-center', containsEditableInput: true },
      cell: ({ row }) => (
        <EstimateCell
          income={row.original}
          onToggle={next => handleToggleEstimate(row.original.id, next)}
          disabled={!!pendingById[row.original.id]}
        />
      ),
    }),
    columnHelper.accessor('frequency_type', {
      id: 'frequency_type',
      header: 'Frequency',
      size: INCOMES_GRID_DEFAULT_WIDTHS.frequency_type,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => <FrequencyCell income={row.original} onChange={(field, v) => handleUpdate(row.original.id, field, v)} disabled={!!pendingById[row.original.id]} />,
    }),
    columnHelper.accessor(
      row => toMonthly(row.amount, row.frequency_type, row.frequency_param ?? undefined),
      {
        id: 'monthly',
        header: 'Monthly',
        size: INCOMES_GRID_DEFAULT_WIDTHS.monthly,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { headerClassName: 'text-right', cellClassName: `text-right tabular-nums text-xs ${GRID_READONLY_TEXT_CLASS}` },
        cell: ({ getValue }) => `$${Math.round(getValue())}`,
      },
    ),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      enableResizing: false,
      size: INCOMES_GRID_DEFAULT_WIDTHS.actions,
      minSize: INCOMES_GRID_DEFAULT_WIDTHS.actions,
      maxSize: INCOMES_GRID_DEFAULT_WIDTHS.actions,
      meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
      cell: ({ row }) => (
        <IncomeActionsCell
          income={row.original}
          onRemove={handleRemove}
          onConvert={handleConvert}
          disabled={!!pendingById[row.original.id]}
        />
      ),
    }),
  ], [partnerX, partnerY, pendingById]);

  const table = useReactTable({
    data: filteredIncomes,
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

  const xTotal = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const yTotal = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const total = xTotal + yTotal;
  const ratioX = total > 0 ? (xTotal / total * 100) : 50;
  const ratioTooltipText = 'These percentages are raw income ratios and are not adjusted for wage gaps. Wage gap-adjusted ratios appear on the Summary view.';
  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'px-0 pb-2.5';
  const emptyIncomeMessage = incomes.length === 0
    ? 'No income yet. Click "Add" to start.'
    : 'No incomes match the filter';

  return (
    <>
      <Card className={fullView ? 'max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 border-t-0 border-b-0 md:border-t h-full min-h-0 flex flex-col' : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Incomes</CardTitle>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {isMobile ? (
                <>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={openViewControlsModal}>
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                  {hasNameFilter && (
                    <Button
                      type="button"
                      variant="outline-warning"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={clearViewControls}
                      aria-label="Clear filters"
                    >
                      <FilterX className="h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Input
                    name="incomes-filter-query"
                    value={filterName}
                    onChange={(event) => setFilterName(event.target.value)}
                    placeholder="Income"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="h-8 w-36 text-xs"
                    aria-label="Filter"
                  />
                  <Button
                    type="button"
                    variant="outline-warning"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={clearViewControls}
                    aria-label="Clear filters"
                    disabled={!hasNameFilter}
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                onClick={openAddIncomeModal}
                disabled={savingIncome}
                variant="outline-success"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Add income"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={gridCardContentClassName}>
          <DataGrid
            table={table}
            fullView={fullView}
            maxHeight={fullView ? 'none' : undefined}
            className={fullView ? 'h-full min-h-0' : undefined}
            emptyMessage={emptyIncomeMessage}
            footer={incomes.length > 0 ? (
              <>
                <tr className={`${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS}`}>
                  <td className={`h-9 align-middle font-semibold text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>Totals</td>
                  <td colSpan={4} className={`h-9 align-middle text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>
                    {partnerX} ${Math.round(xTotal)} (
                    {wageGapAdjustmentEnabled ? (
                      <PersistentTooltipText align="start" side="top" contentClassName="text-xs" content={ratioTooltipText}>
                        {`${ratioX.toFixed(0)}%`}
                      </PersistentTooltipText>
                    ) : (
                      `${ratioX.toFixed(0)}%`
                    )}
                    ) • {partnerY} ${Math.round(yTotal)} (
                    {wageGapAdjustmentEnabled ? (
                      <PersistentTooltipText align="start" side="top" contentClassName="text-xs" content={ratioTooltipText}>
                        {`${(100 - ratioX).toFixed(0)}%`}
                      </PersistentTooltipText>
                    ) : (
                      `${(100 - ratioX).toFixed(0)}%`
                    )}
                    )
                  </td>
                  <td className={`h-9 align-middle text-right font-semibold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>${Math.round(total)}</td>
                  <td className={GRID_HEADER_TONE_CLASS} />
                </tr>
              </>
            ) : undefined}
          />
        </CardContent>
        <Dialog
          open={addIncomeOpen}
          onOpenChange={open => {
            if (!open && !savingIncome) {
              setAddIncomeOpen(false);
              setNewIncome(createDefaultIncomeDraft());
            }
          }}
        >
          <DialogContent
            className={`sm:max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col ${savingIncome ? '[&>button]:pointer-events-none [&>button]:opacity-50' : ''}`}
            onInteractOutside={(event) => {
              event.preventDefault();
            }}
          >
            <DialogHeader><DialogTitle>Add Income</DialogTitle></DialogHeader>
            <DialogBody className="min-h-0 flex-1 overflow-y-auto shadow-[inset_0_5px_6px_-6px_hsl(var(--foreground)/0.25),inset_0_-5px_6px_-6px_hsl(var(--foreground)/0.25)]">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <DataGridAddFormLabel htmlFor="new-income-name">Name</DataGridAddFormLabel>
                  <Input
                    id="new-income-name"
                    value={newIncome.name}
                    onChange={e => setNewIncome(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                    disabled={savingIncome}
                  />
                </div>

                <div className="space-y-1.5">
                  <DataGridAddFormLabel>Partner</DataGridAddFormLabel>
                  <Select
                    value={newIncome.partner_label}
                    onValueChange={v => setNewIncome(prev => ({ ...prev, partner_label: v }))}
                    disabled={savingIncome}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="X">{partnerX}</SelectItem>
                      <SelectItem value="Y">{partnerY}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <DataGridAddFormLabel>Type</DataGridAddFormLabel>
                  <Select
                    value={newIncome.value_type}
                    onValueChange={(value) => handleNewIncomeTypeChange(value as BudgetValueType)}
                    disabled={savingIncome}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALUE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
                            <span>{option.label}</span>
                            <span className="text-[11px] text-muted-foreground">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newIncome.value_type === 'simple' ? (
                  <>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                      <div className="space-y-1.5">
                        <DataGridAddFormLabel htmlFor="new-income-amount">Amount</DataGridAddFormLabel>
                        <DataGridAddFormAffixInput
                          id="new-income-amount"
                          prefix="$"
                          value={String(newIncome.amount)}
                          onChange={e => setNewIncome(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                          disabled={savingIncome}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <DataGridAddFormLabel htmlFor="new-income-estimate" tooltip="Estimated means this value was manually marked as estimated." tooltipTabStop={false}>Estimated</DataGridAddFormLabel>
                        <div className="h-9 flex items-center -translate-y-0.5">
                          <Checkbox
                            id="new-income-estimate"
                            checked={newIncome.is_estimate}
                            onCheckedChange={checked => setNewIncome(prev => ({ ...prev, is_estimate: !!checked }))}
                            disabled={savingIncome}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <DataGridAddFormLabel>Frequency</DataGridAddFormLabel>
                      <div className="flex items-center gap-2">
                        <Select
                          value={newIncome.frequency_type}
                          onValueChange={v => {
                            const nextFreq = v as FrequencyType;
                            setNewIncome(prev => ({
                              ...prev,
                              frequency_type: nextFreq,
                              frequency_param: needsParam(nextFreq) ? prev.frequency_param : null,
                            }));
                          }}
                          disabled={savingIncome}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map(f => <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {needsParam(newIncome.frequency_type) && (
                          <Input
                            type="number"
                            value={newIncome.frequency_param == null ? '' : String(newIncome.frequency_param)}
                            onChange={e => setNewIncome(prev => ({ ...prev, frequency_param: e.target.value ? Number(e.target.value) : null }))}
                            disabled={savingIncome}
                            className="w-24"
                            placeholder="X"
                          />
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <AverageRecordsEditor
                    valueType={newIncome.value_type}
                    records={newIncome.average_records}
                    onChange={records => setNewIncome(prev => ({ ...prev, average_records: records }))}
                    currentPeriodHandling={newIncome.current_period_handling}
                    onCurrentPeriodHandlingChange={currentPeriodHandling => setNewIncome(prev => ({ ...prev, current_period_handling: currentPeriodHandling }))}
                    disabled={savingIncome}
                  />
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddIncomeOpen(false);
                  setNewIncome(createDefaultIncomeDraft());
                }}
                disabled={savingIncome}
              >
                Cancel
              </Button>
              <Button data-dialog-confirm="true" variant="outline-success" onClick={handleSaveIncome} disabled={savingIncome}>{savingIncome ? 'Saving...' : 'Add'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      <Dialog open={viewControlsOpen} onOpenChange={setViewControlsOpen}>
        <DialogContent className="w-screen max-w-none rounded-none sm:w-full sm:max-w-sm sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="incomes-filter-query">Filter</Label>
              <Input
                id="incomes-filter-query"
                name="incomes-filter-query-modal"
                value={draftFilterName}
                onChange={(event) => setDraftFilterName(event.target.value)}
                placeholder="Income"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewControlsOpen(false)}>
              Cancel
            </Button>
            <Button data-dialog-confirm="true" type="button" onClick={applyViewControls}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={averageEditorState !== null}
        onOpenChange={open => {
          if (!open && !savingAverageEditor) setAverageEditorState(null);
        }}
      >
        <DialogContent
          className={`sm:max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col ${savingAverageEditor ? '[&>button]:pointer-events-none [&>button]:opacity-50' : ''}`}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{averageEditorState?.title ?? 'Edit Averaged Records'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto shadow-[inset_0_5px_6px_-6px_hsl(var(--foreground)/0.25),inset_0_-5px_6px_-6px_hsl(var(--foreground)/0.25)]">
            {averageEditorState && (
              <AverageRecordsEditor
                valueType={averageEditorState.targetValueType}
                records={averageEditorState.records}
                onChange={records => setAverageEditorState(prev => prev ? { ...prev, records } : prev)}
                currentPeriodHandling={averageEditorState.currentPeriodHandling}
                onCurrentPeriodHandlingChange={currentPeriodHandling => setAverageEditorState(prev => prev ? { ...prev, currentPeriodHandling } : prev)}
                disabled={savingAverageEditor}
                autoFocusAddButton
                onSubmitFromAmountEnter={() => {
                  void handleSaveAverageEditor();
                }}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAverageEditorState(null)}
              disabled={savingAverageEditor}
            >
              Cancel
            </Button>
            <Button data-dialog-confirm="true" variant="outline-success" onClick={handleSaveAverageEditor} disabled={savingAverageEditor}>{savingAverageEditor ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={convertToSimpleState !== null} onOpenChange={(open) => { if (!open && !savingConvertToSimple) setConvertToSimpleState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to simple income?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the current averaged amount and removes the contributing records. The converted income will be marked as estimated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingConvertToSimple}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingConvertToSimple}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmConvertToSimple();
              }}
            >
              {savingConvertToSimple ? 'Converting...' : 'Convert'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
