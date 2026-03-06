import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import { PersistentTooltipText } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ManagedListSection';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { DataGridAddFormAffixInput } from '@/components/ui/data-grid-add-form-affix-input';
import { Plus, Trash2, MoreHorizontal, Filter, FilterX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toMonthly, frequencyLabels, needsParam, fromMonthly } from '@/lib/frequency';
import { DataGrid, GridCheckboxCell, GridEditableCell, GridCurrencyCell, GridPercentCell, gridMenuTriggerProps, gridNavProps, useDataGrid, GRID_HEADER_TONE_CLASS, GRID_READONLY_TEXT_CLASS } from '@/components/ui/data-grid';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { EXPENSES_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS, GRID_MIN_COLUMN_WIDTH } from '@/lib/gridColumnWidths';
import { useIsMobile } from '@/hooks/use-mobile';
import { COLOR_LABELS, normalizePaletteColor } from '@/lib/colors';
import { computeFairShares, computeIncomeNormalization } from '@/lib/fairShare';
import type { FrequencyType } from '@/types/fairshare';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Income } from '@/hooks/useIncomes';
import {
  enforceExpenseTypeInvariants,
  getAveragedFrequencyLabel,
  seedAverageRecordsFromSimpleAmount,
  sortAverageRecordsForEditor,
  convertAverageRecordsForValueType,
  type BudgetAverageRecord,
  type BudgetValueType,
} from '@/lib/budgetAveraging';
import { AverageRecordsEditor } from '@/components/AverageRecordsEditor';

// ─── Types ───

interface ComputedRow {
  exp: Expense;
  fairX: number;
  fairY: number;
  monthly: number;
}

interface ExpensesTabProps {
  expenses: Expense[];
  categories: Category[];
  linkedAccounts: LinkedAccount[];
  incomes: Income[];
  partnerX: string;
  partnerY: string;
  wageGapAdjustmentEnabled?: boolean;
  partnerXWageCentsPerDollar?: number | null;
  partnerYWageCentsPerDollar?: number | null;
  userId?: string;
  pendingById?: Record<string, boolean>;
  onAdd: (expense: Omit<Expense, 'id' | 'household_id'>, id?: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAddCategory: (name: string, color?: string | null, id?: string) => Promise<void>;
  onAddLinkedAccount: (name: string, ownerPartner?: string, color?: string | null, id?: string) => Promise<void>;
  fullView?: boolean;
}

const FREQ_OPTIONS: FrequencyType[] = ['weekly', 'twice_monthly', 'monthly', 'annual', 'every_n_days', 'every_n_weeks', 'every_n_months', 'k_times_weekly', 'k_times_monthly', 'k_times_annually'];
type GroupByOption = 'none' | 'category' | 'estimated' | 'payer' | 'payment_method';
type AddSource =
  | { type: 'existing_expense'; expenseId: string; field: 'category_id' | 'linked_account_id' }
  | { type: 'new_expense'; field: 'category_id' | 'linked_account_id' };
type NewExpenseDraft = Omit<Expense, 'id' | 'household_id'>;
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

const columnHelper = createColumnHelper<ComputedRow>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const EXPENSE_ACTIONS_NAV_COL = 12;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function DropdownOptionColorSwatch({ color }: { color?: string | null }) {
  const normalizedColor = normalizePaletteColor(color);
  if (!normalizedColor) return null;

  return (
    <span
      aria-hidden="true"
      className="h-3 w-3 rounded-sm border border-white/20"
      style={{ backgroundColor: normalizedColor }}
    />
  );
}

function CategoryOptionLabel({ category }: { category: Category }) {
  return (
    <span className="flex w-full min-w-0 items-center gap-2">
      <span className="truncate">{category.name}</span>
    </span>
  );
}

function formatFrequencyDescription(type: FrequencyType, param: number | null) {
  const label = frequencyLabels[type];
  if (!needsParam(type) || param == null) return label;
  return label.split('X').join(String(param));
}

function normalizedMonthlyTooltipContent(monthly: number) {
  const { daily, weekly, annual } = fromMonthly(monthly);
  return (
    <div className="space-y-1 text-left">
      <div>Daily: ${daily.toFixed(2)}</div>
      <div>Weekly: ${weekly.toFixed(2)}</div>
      <div>Annually: ${annual.toFixed(2)}</div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const createDefaultExpenseDraft = (): NewExpenseDraft => ({
  name: '',
  amount: 0,
  benefit_x: 50,
  category_id: null,
  budget_id: null,
  linked_account_id: null,
  frequency_type: 'monthly',
  frequency_param: null,
  is_estimate: false,
  value_type: 'simple',
  average_records: [],
});

export function applyNewExpenseTypeToDraft(
  previous: NewExpenseDraft,
  nextType: BudgetValueType,
  currentDate: Date = new Date(),
): NewExpenseDraft {
  if (previous.value_type === nextType) return previous;
  if (nextType === 'simple') {
    return {
      ...previous,
      value_type: nextType,
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
    average_records: seededRecords,
  };
}

// ─── Cell Components ───

function CategoryCell({ exp, categories, onChange, onAddNew, disabled = false }: {
  exp: Expense; categories: Category[]; onChange: (v: string) => void; onAddNew: () => void; disabled?: boolean;
}) {
  const ctx = useDataGrid();
  return (
    <Select value={exp.category_id ?? '_none'} onValueChange={v => {
      if (v === '_add_new') {
        onAddNew();
        return;
      }
      ctx?.onCellCommit(1);
      onChange(v);
    }} disabled={disabled}>
      <SelectTrigger
        disabled={disabled}
        className={`h-7 border-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm ${GRID_CONTROL_FOCUS_CLASS}`}
        style={{ backgroundColor: normalizePaletteColor(categories.find(c => c.id === exp.category_id)?.color) || 'transparent' }}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={1}
        onMouseDown={ctx?.onCellMouseDown}
        onKeyDown={(e) => {
          if (!ctx) return;
          const expanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
          if (expanded) return;
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
            ctx.onCellKeyDown(e);
          }
        }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">—</SelectItem>
        {categories.map(c => (
          <SelectItem key={c.id} value={c.id} rightAdornment={<DropdownOptionColorSwatch color={c.color} />}>
            <CategoryOptionLabel category={c} />
          </SelectItem>
        ))}
        <SelectItem value="_add_new" className="text-primary font-medium"><Plus className="inline h-3 w-3 mr-1" />Add New</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ExpenseFrequencyCell({ exp, onChange, disabled = false }: { exp: Expense; onChange: (field: string, v: string) => void; disabled?: boolean }) {
  const ctx = useDataGrid();
  if (exp.value_type !== 'simple') {
    return <span className={`block px-1 text-xs ${GRID_READONLY_TEXT_CLASS}`}>{getAveragedFrequencyLabel(exp.value_type)}</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={exp.frequency_type} onValueChange={v => {
        ctx?.onCellCommit(4);
        onChange('frequency_type', v);
      }} disabled={disabled}>
        <SelectTrigger
          disabled={disabled}
          className={`h-7 min-w-0 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
          data-row={ctx?.rowIndex}
          data-row-id={ctx?.rowId}
          data-col={4}
          onMouseDown={ctx?.onCellMouseDown}
          onKeyDown={(e) => {
            if (!ctx) return;
            const expanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
            if (expanded) return;
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
              ctx.onCellKeyDown(e);
            }
          }}
        >
          <SelectValue />
        </SelectTrigger>
      <SelectContent>
          {FREQ_OPTIONS.map(f => <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>)}
        </SelectContent>
      </Select>
      {needsParam(exp.frequency_type) && (
        <GridEditableCell value={exp.frequency_param ?? ''} onChange={v => onChange('frequency_param', v)} type="number" navCol={5} placeholder="X" className="text-left w-8 shrink-0" disabled={disabled} />
      )}
    </div>
  );
}

function PaymentMethodCell({ exp, linkedAccounts, partnerX, partnerY, onChange, onAddNew, disabled = false }: {
  exp: Expense; linkedAccounts: LinkedAccount[]; partnerX: string; partnerY: string; onChange: (v: string) => void; onAddNew: () => void; disabled?: boolean;
}) {
  const ctx = useDataGrid();
  return (
    <Select value={exp.linked_account_id ?? '_none'} onValueChange={v => {
      if (v === '_add_new') {
        onAddNew();
        return;
      }
      ctx?.onCellCommit(6);
      onChange(v);
    }} disabled={disabled}>
      <SelectTrigger
        disabled={disabled}
        className={`h-7 border-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm ${GRID_CONTROL_FOCUS_CLASS}`}
        style={{ backgroundColor: normalizePaletteColor(linkedAccounts.find(la => la.id === exp.linked_account_id)?.color) || 'transparent' }}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={6}
        onMouseDown={ctx?.onCellMouseDown}
        onKeyDown={(e) => {
          if (!ctx) return;
          const expanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
          if (expanded) return;
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
            ctx.onCellKeyDown(e);
          }
        }}
      >
        <SelectValue>
          {exp.linked_account_id ? linkedAccounts.find(la => la.id === exp.linked_account_id)?.name ?? '—' : '—'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">—</SelectItem>
        {linkedAccounts.map(la => (
          <SelectItem
            key={la.id}
            value={la.id}
            rightAdornment={<DropdownOptionColorSwatch color={la.color} />}
          >
            {la.name} <span className="text-muted-foreground">({la.owner_partner === 'X' ? partnerX : partnerY})</span>
          </SelectItem>
        ))}
        <SelectItem value="_add_new" className="text-primary font-medium"><Plus className="inline h-3 w-3 mr-1" />Add New</SelectItem>
      </SelectContent>
    </Select>
  );
}

function EstimateCell({ checked, onToggle, disabled = false }: { checked: boolean; onToggle: (v: boolean) => void | Promise<unknown>; disabled?: boolean }) {
  return (
    <GridCheckboxCell
      checked={checked}
      onChange={onToggle}
      navCol={3}
      disabled={disabled}
      className={disabled ? 'ml-1 opacity-60' : 'ml-1 hover:border-[hsl(var(--grid-sticky-line))]'}
    />
  );
}

function AveragedAmountCell({
  expense,
  onEdit,
  disabled = false,
}: {
  expense: Expense;
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
        className={`h-7 w-full rounded-md border border-transparent bg-transparent pl-4 pr-2 text-right tabular-nums text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 hover:border-[hsl(var(--grid-sticky-line))] ${GRID_CONTROL_FOCUS_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={onEdit}
        {...gridNavProps(ctx, 2)}
        aria-label={`Edit averaged records for ${expense.name}`}
      >
        {Math.round(expense.amount)}
      </button>
    </div>
  );
}

function ExpenseActionsCell({
  expense,
  onRemove,
  onConvert,
  disabled = false,
}: {
  expense: Expense;
  onRemove: () => void;
  onConvert: (expense: Expense, targetType: BudgetValueType) => void;
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
            aria-label={`Actions for ${expense.name}`}
            {...gridMenuTriggerProps(ctx, EXPENSE_ACTIONS_NAV_COL)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          {expense.value_type !== 'simple' && (
            <DropdownMenuItem onClick={() => onConvert(expense, 'simple')}>
              Convert to Simple Expense
            </DropdownMenuItem>
          )}
          {expense.value_type !== 'monthly_averaged' && (
            <DropdownMenuItem onClick={() => onConvert(expense, 'monthly_averaged')}>
              Convert to Monthly Avg Expense
            </DropdownMenuItem>
          )}
          {expense.value_type !== 'yearly_averaged' && (
            <DropdownMenuItem onClick={() => onConvert(expense, 'yearly_averaged')}>
              Convert to Yearly Avg Expense
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
          <AlertDialogTitle>Delete expense</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete &ldquo;{expense.name}&rdquo;? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onRemove}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Component ───

export function ExpensesTab({
  expenses,
  categories,
  linkedAccounts,
  incomes,
  partnerX,
  partnerY,
  wageGapAdjustmentEnabled = false,
  partnerXWageCentsPerDollar = null,
  partnerYWageCentsPerDollar = null,
  userId,
  pendingById = {},
  onAdd,
  onUpdate,
  onRemove,
  onAddCategory,
  onAddLinkedAccount,
  fullView = false,
}: ExpensesTabProps) {
  const isMobile = useIsMobile();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<NewExpenseDraft>(createDefaultExpenseDraft);
  const [addDialog, setAddDialog] = useState<'category' | 'payment_method' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemOwner, setNewItemOwner] = useState<'X' | 'Y'>('X');
  const [newItemColor, setNewItemColor] = useState<string | null>(null);
  const [addSource, setAddSource] = useState<AddSource | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [averageEditorState, setAverageEditorState] = useState<{
    expense: Expense;
    targetValueType: AveragedValueType;
    records: BudgetAverageRecord[];
    title: string;
  } | null>(null);
  const [savingAverageEditor, setSavingAverageEditor] = useState(false);
  const [convertToSimpleState, setConvertToSimpleState] = useState<{
    expense: Expense;
    amount: number;
    frequency_type: FrequencyType;
  } | null>(null);
  const [savingConvertToSimple, setSavingConvertToSimple] = useState(false);

  type PayerFilter = 'all' | 'X' | 'Y' | 'unassigned';
  const [filterPayer, setFilterPayer] = useState<PayerFilter>(() => {
    const stored = localStorage.getItem('expenses_filterPayer');
    return stored === 'X' || stored === 'Y' || stored === 'unassigned' || stored === 'all' ? stored : 'all';
  });
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => (localStorage.getItem('expenses_groupBy') as GroupByOption) || 'none');
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [draftFilterPayer, setDraftFilterPayer] = useState<PayerFilter>('all');
  const [draftGroupBy, setDraftGroupBy] = useState<GroupByOption>('none');
  const [sorting, setSorting] = useState<SortingState>(() => {
    try { const s = localStorage.getItem('expenses_sorting'); return s ? JSON.parse(s) : [{ id: 'name', desc: false }]; }
    catch { return [{ id: 'name', desc: false }]; }
  });

  useEffect(() => { localStorage.setItem('expenses_filterPayer', filterPayer); }, [filterPayer]);
  useEffect(() => { localStorage.setItem('expenses_groupBy', groupBy); }, [groupBy]);
  useEffect(() => { localStorage.setItem('expenses_sorting', JSON.stringify(sorting)); }, [sorting]);

  const {
    columnSizing,
    columnSizingInfo,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'expenses',
    defaults: EXPENSES_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.expenses,
  });

  // Income ratio
  const incomeX = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const incomeY = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const incomeNormalization = useMemo(() => computeIncomeNormalization(incomeX, incomeY, {
    enabled: wageGapAdjustmentEnabled,
    partnerXCentsPerDollar: partnerXWageCentsPerDollar,
    partnerYCentsPerDollar: partnerYWageCentsPerDollar,
  }), [incomeX, incomeY, partnerXWageCentsPerDollar, partnerYWageCentsPerDollar, wageGapAdjustmentEnabled]);
  const incomeRatioX = incomeNormalization.incomeRatioX;
  const incomeRatioY = incomeNormalization.incomeRatioY;
  const isWageGapApplied = incomeNormalization.isWageGapApplied;

  const computeFairShare = (exp: Expense) => {
    const monthly = toMonthly(exp.amount, exp.frequency_type, exp.frequency_param ?? undefined);
    const { fairX, fairY } = computeFairShares(monthly, exp.benefit_x, incomeRatioX);
    return { fairX, fairY, monthly };
  };

  const payerByLinkedAccountId = useMemo(
    () => new Map(linkedAccounts.map((a) => [a.id, a.owner_partner])),
    [linkedAccounts],
  );

  const getDerivedPayerByLinkedAccountId = useCallback((linkedAccountId: string | null): 'X' | 'Y' | null => {
    if (!linkedAccountId) return null;
    const owner = payerByLinkedAccountId.get(linkedAccountId);
    return owner === 'X' || owner === 'Y' ? owner : null;
  }, [payerByLinkedAccountId]);

  const getDerivedPayer = useCallback((exp: Pick<Expense, 'linked_account_id'>): 'X' | 'Y' | null => (
    getDerivedPayerByLinkedAccountId(exp.linked_account_id)
  ), [getDerivedPayerByLinkedAccountId]);

  const isVisibleWithCurrentPayerFilter = useCallback((linkedAccountId: string | null): boolean => {
    const derivedPayer = getDerivedPayerByLinkedAccountId(linkedAccountId);
    if (filterPayer === 'all') return true;
    if (filterPayer === 'unassigned') return derivedPayer === null;
    return derivedPayer === filterPayer;
  }, [filterPayer, getDerivedPayerByLinkedAccountId]);

  const filteredExpenses = useMemo(() =>
    filterPayer === 'all'
      ? expenses
      : filterPayer === 'unassigned'
        ? expenses.filter((e) => getDerivedPayer(e) === null)
        : expenses.filter((e) => getDerivedPayer(e) === filterPayer),
    [expenses, filterPayer, getDerivedPayer],
  );
  const computedData: ComputedRow[] = useMemo(() =>
    filteredExpenses.map(exp => ({ exp, ...computeFairShare(exp) })),
    [filteredExpenses, incomeRatioX],
  );
  const emptyExpensesMessage = expenses.length === 0
    ? 'No expenses yet. Click "Add" to start.'
    : 'No expenses match the filter.';

  let totalFairX = 0, totalFairY = 0, totalMonthly = 0;
  computedData.forEach(r => { totalFairX += r.fairX; totalFairY += r.fairY; totalMonthly += r.monthly; });

  // ─── Handlers ───

  const openAddExpenseModal = () => {
    setNewExpense(createDefaultExpenseDraft());
    setAddExpenseOpen(true);
  };

  const hasActiveViewControls = filterPayer !== 'all' || groupBy !== 'none';

  const clearViewControls = () => {
    setFilterPayer('all');
    setGroupBy('none');
  };

  const openViewControlsModal = () => {
    setDraftFilterPayer(filterPayer);
    setDraftGroupBy(groupBy);
    setViewControlsOpen(true);
  };

  const applyViewControls = () => {
    setFilterPayer(draftFilterPayer);
    setGroupBy(draftGroupBy);
    setViewControlsOpen(false);
  };

  const openNewItemDialog = (source: AddSource, type: 'category' | 'payment_method') => {
    setNewItemName('');
    setNewItemOwner('X');
    setNewItemColor(null);
    setAddSource(source);
    setAddDialog(type);
  };

  const openAverageEditor = (
    expense: Expense,
    targetValueType: AveragedValueType,
    records: BudgetAverageRecord[],
    title: string,
  ) => {
    setAverageEditorState({ expense, targetValueType, records: sortAverageRecordsForEditor(records), title });
  };

  const handleNewExpenseTypeChange = (nextType: BudgetValueType) => {
    setNewExpense((previous) => applyNewExpenseTypeToDraft(previous, nextType));
  };

  const handleSaveNewExpense = async () => {
    if (savingExpense) return;
    setSavingExpense(true);
    try {
      let payload: NewExpenseDraft;
      if (newExpense.value_type === 'simple') {
        payload = {
          ...newExpense,
          frequency_param: needsParam(newExpense.frequency_type) ? newExpense.frequency_param : null,
          average_records: [],
        };
      } else {
        const averagedPayload = enforceExpenseTypeInvariants(newExpense.value_type, {
          amount: newExpense.amount,
          frequency_type: newExpense.frequency_type,
          frequency_param: newExpense.frequency_param,
          is_estimate: newExpense.is_estimate,
          average_records: newExpense.average_records,
        });
        payload = {
          ...newExpense,
          ...averagedPayload,
        };
      }
      const isVisibleInGrid = isVisibleWithCurrentPayerFilter(payload.linked_account_id);
      await onAdd(payload);
      setAddExpenseOpen(false);
      setNewExpense(createDefaultExpenseDraft());
      if (!isVisibleInGrid) {
        toast({
          title: 'Expense added but hidden by filters',
          description: 'The expense was added, but it is not visible because of the current filters.',
        });
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
    setSavingExpense(false);
  };

  const handleUpdate = (id: string, field: string, value: string) => {
    const updates: Record<string, unknown> = {};
    if (field === 'name') updates.name = value;
    else if (field === 'amount') updates.amount = Number(value) || 0;
    else if (field === 'benefit_x') updates.benefit_x = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    else if (field === 'frequency_param') updates.frequency_param = value ? Number(value) : null;
    else if (field === 'category_id') updates.category_id = value === '_none' ? null : value;
    else if (field === 'linked_account_id') {
      updates.linked_account_id = value === '_none' ? null : value;
    } else updates[field] = value;
    onUpdate(id, updates as Partial<Omit<Expense, 'id' | 'household_id'>>).catch((error: unknown) => {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
    });
  };

  const handleToggleEstimate = (id: string, checked: boolean) => {
    return onUpdate(id, { is_estimate: checked }).catch((error: unknown) => {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
      throw error;
    });
  };

  const handleRemove = async (id: string) => {
    try { await onRemove(id); } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleConvert = (expense: Expense, targetType: BudgetValueType) => {
    if (targetType === expense.value_type) return;

    if (targetType === 'simple') {
      const frequency_type: FrequencyType = expense.value_type === 'monthly_averaged' ? 'monthly' : 'annual';
      setConvertToSimpleState({
        expense,
        amount: expense.amount,
        frequency_type,
      });
      return;
    }

    if (expense.value_type === 'simple') {
      const records = seedAverageRecordsFromSimpleAmount(targetType, expense.amount);
      openAverageEditor(
        expense,
        targetType,
        records,
        `Convert ${expense.name} to ${targetType === 'monthly_averaged' ? 'Monthly Averaged' : 'Yearly Averaged'} Expense`,
      );
      return;
    }

    const records = convertAverageRecordsForValueType(expense.average_records, expense.value_type, targetType);
    openAverageEditor(
      expense,
      targetType,
      records,
      `Convert ${expense.name} to ${targetType === 'monthly_averaged' ? 'Monthly Averaged' : 'Yearly Averaged'} Expense`,
    );
  };

  const handleSaveAverageEditor = async () => {
    if (!averageEditorState || savingAverageEditor) return;
    setSavingAverageEditor(true);

    const payload = enforceExpenseTypeInvariants(averageEditorState.targetValueType, {
      amount: averageEditorState.expense.amount,
      frequency_type: averageEditorState.expense.frequency_type,
      frequency_param: averageEditorState.expense.frequency_param,
      is_estimate: averageEditorState.expense.is_estimate,
      average_records: averageEditorState.records,
    });

    try {
      await onUpdate(averageEditorState.expense.id, payload);
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
      await onUpdate(convertToSimpleState.expense.id, {
        value_type: 'simple',
        average_records: [],
        amount: convertToSimpleState.amount,
        frequency_type: convertToSimpleState.frequency_type,
        frequency_param: null,
        is_estimate: true,
      });
      setConvertToSimpleState(null);
    } catch (error: unknown) {
      toast({ title: 'Error saving', description: getErrorMessage(error), variant: 'destructive' });
    }

    setSavingConvertToSimple(false);
  };

  const handleSaveNewItem = async () => {
    if (!newItemName.trim()) return;
    setSavingItem(true);
    try {
      if (addDialog === 'category') {
        const newCategoryId = crypto.randomUUID();
        await onAddCategory(newItemName.trim(), newItemColor, newCategoryId);
        if (addSource?.field === 'category_id') {
          if (addSource.type === 'existing_expense') {
            await onUpdate(addSource.expenseId, { category_id: newCategoryId });
          } else {
            setNewExpense(prev => ({ ...prev, category_id: newCategoryId }));
          }
        }
      } else if (addDialog === 'payment_method') {
        const newLinkedAccountId = crypto.randomUUID();
        await onAddLinkedAccount(newItemName.trim(), newItemOwner, newItemColor, newLinkedAccountId);
        if (addSource?.field === 'linked_account_id') {
          if (addSource.type === 'existing_expense') {
            await onUpdate(addSource.expenseId, { linked_account_id: newLinkedAccountId });
          } else {
            setNewExpense(prev => ({ ...prev, linked_account_id: newLinkedAccountId }));
          }
        }
      }
      setAddDialog(null);
      setAddSource(null);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
    setSavingItem(false);
  };

  // ─── Columns ───

  const columns = useMemo(() => [
    columnHelper.accessor(r => r.exp.name, {
      id: 'name',
      header: 'Name',
      size: EXPENSES_GRID_DEFAULT_WIDTHS.name,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.exp.name}
          onChange={v => handleUpdate(row.original.exp.id, 'name', v)}
          navCol={0}
          placeholder="Expense"
          cellId={row.original.exp.id}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
    columnHelper.accessor(r => r.exp.category_id, {
      id: 'category',
      header: 'Category',
      size: EXPENSES_GRID_DEFAULT_WIDTHS.category,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      sortingFn: (a, b) => (categories.find(c => c.id === a.original.exp.category_id)?.name ?? '').localeCompare(categories.find(c => c.id === b.original.exp.category_id)?.name ?? ''),
      cell: ({ row }) => (
        <CategoryCell
          exp={row.original.exp}
          categories={categories}
          onChange={v => handleUpdate(row.original.exp.id, 'category_id', v)}
          onAddNew={() => openNewItemDialog({ type: 'existing_expense', expenseId: row.original.exp.id, field: 'category_id' }, 'category')}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
    columnHelper.accessor(r => r.exp.amount, {
      id: 'amount',
      header: 'Amount',
      size: EXPENSES_GRID_DEFAULT_WIDTHS.amount,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', containsEditableInput: true },
      cell: ({ row }) => {
        if (row.original.exp.value_type === 'simple') {
          return (
            <GridCurrencyCell
              value={Number(row.original.exp.amount)}
              onChange={v => handleUpdate(row.original.exp.id, 'amount', v)}
              navCol={2}
              disabled={!!pendingById[row.original.exp.id]}
            />
          );
        }

        return (
          <AveragedAmountCell
            expense={row.original.exp}
            onEdit={() => openAverageEditor(
              row.original.exp,
              row.original.exp.value_type as AveragedValueType,
              row.original.exp.average_records,
              `Edit ${row.original.exp.value_type === 'monthly_averaged' ? 'Monthly' : 'Yearly'} Records`,
            )}
            disabled={!!pendingById[row.original.exp.id]}
          />
        );
      },
    }),
    columnHelper.accessor(r => r.exp.is_estimate, {
      id: 'estimate',
      header: () => (
        <PersistentTooltipText side="bottom" content="Estimated means this value was manually marked as estimated or derived from averaging multiple records.">Est</PersistentTooltipText>
      ),
      size: EXPENSES_GRID_DEFAULT_WIDTHS.estimate,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-center', cellClassName: 'text-center', containsEditableInput: true },
      cell: ({ row }) => (
        <EstimateCell
          checked={row.original.exp.value_type === 'simple' ? row.original.exp.is_estimate : true}
          onToggle={v => {
            if (row.original.exp.value_type !== 'simple') return;
            return handleToggleEstimate(row.original.exp.id, v);
          }}
          disabled={!!pendingById[row.original.exp.id] || row.original.exp.value_type !== 'simple'}
        />
      ),
    }),
    columnHelper.accessor(r => r.exp.frequency_type, {
      id: 'frequency',
      header: 'Frequency',
      size: EXPENSES_GRID_DEFAULT_WIDTHS.frequency,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <ExpenseFrequencyCell
          exp={row.original.exp}
          onChange={(field, v) => handleUpdate(row.original.exp.id, field, v)}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
    columnHelper.accessor('monthly', {
      id: 'monthly',
      header: () => (
        <PersistentTooltipText side="bottom" content="Expense normalized to how much it costs you monthly">Monthly</PersistentTooltipText>
      ),
      size: EXPENSES_GRID_DEFAULT_WIDTHS.monthly,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', cellClassName: `text-right tabular-nums text-xs ${GRID_READONLY_TEXT_CLASS}` },
      cell: ({ getValue }) => {
        const monthly = Number(getValue());
        return (
          <PersistentTooltipText
            align="end"
            side="top"
            contentClassName="text-xs tabular-nums"
            content={normalizedMonthlyTooltipContent(monthly)}
          >
            {`$${Math.round(monthly)}`}
          </PersistentTooltipText>
        );
      },
    }),
    columnHelper.accessor(r => r.exp.linked_account_id, {
      id: 'payment_method',
      header: 'Payment Method',
      size: EXPENSES_GRID_DEFAULT_WIDTHS.payment_method,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      sortingFn: (a, b) => (linkedAccounts.find(la => la.id === a.original.exp.linked_account_id)?.name ?? '').localeCompare(linkedAccounts.find(la => la.id === b.original.exp.linked_account_id)?.name ?? ''),
      cell: ({ row }) => (
        <PaymentMethodCell
          exp={row.original.exp}
          linkedAccounts={linkedAccounts}
          partnerX={partnerX}
          partnerY={partnerY}
          onChange={v => handleUpdate(row.original.exp.id, 'linked_account_id', v)}
          onAddNew={() => openNewItemDialog({ type: 'existing_expense', expenseId: row.original.exp.id, field: 'linked_account_id' }, 'payment_method')}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
    columnHelper.accessor(r => getDerivedPayer(r.exp), {
      id: 'payer',
      header: 'Payer',
      size: EXPENSES_GRID_DEFAULT_WIDTHS.payer,
      minSize: GRID_MIN_COLUMN_WIDTH,
      sortingFn: (a, b) => (getDerivedPayer(a.original.exp) ?? '').localeCompare(getDerivedPayer(b.original.exp) ?? ''),
      cell: ({ row }) => {
        const p = getDerivedPayer(row.original.exp);
        return p
          ? <span className="text-xs">{p === 'X' ? partnerX : partnerY}</span>
          : <span className={`text-xs ${GRID_READONLY_TEXT_CLASS}`}>—</span>;
      },
    }),
    columnHelper.accessor(r => r.exp.benefit_x, {
      id: 'benefit_x',
      header: () => (
        <PersistentTooltipText side="bottom" content={`The percentage that ${partnerX} benefits from the expense`}>{partnerX} Benefit</PersistentTooltipText>
      ),
      size: EXPENSES_GRID_DEFAULT_WIDTHS.benefit_x,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right whitespace-nowrap', containsEditableInput: true },
      cell: ({ row }) => (
        <GridPercentCell
          value={row.original.exp.benefit_x}
          onChange={v => { const c = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); handleUpdate(row.original.exp.id, 'benefit_x', String(c)); }}
          navCol={7}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
    columnHelper.accessor(r => 100 - r.exp.benefit_x, {
      id: 'benefit_y',
      header: () => (
        <PersistentTooltipText side="bottom" content={`The percentage that ${partnerY} benefits from the expense`}>{partnerY} Benefit</PersistentTooltipText>
      ),
      size: EXPENSES_GRID_DEFAULT_WIDTHS.benefit_y,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right whitespace-nowrap', cellClassName: 'text-right tabular-nums text-xs', containsEditableInput: true },
      cell: ({ row }) => (
        <GridPercentCell
          value={100 - row.original.exp.benefit_x}
          onChange={v => { const c = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); handleUpdate(row.original.exp.id, 'benefit_x', String(100 - c)); }}
          navCol={8}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
    columnHelper.accessor('fairX', {
      id: 'fair_x',
      header: `Fair ${partnerX}`,
      size: EXPENSES_GRID_DEFAULT_WIDTHS.fair_x,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', cellClassName: `text-right tabular-nums text-xs ${GRID_READONLY_TEXT_CLASS}` },
      cell: ({ getValue, row }) => {
        const originalAmount = Number(row.original.exp.amount);
        const shouldShowNormalizationStep = row.original.exp.frequency_type !== 'monthly';
        const frequencyDescription = formatFrequencyDescription(row.original.exp.frequency_type, row.original.exp.frequency_param);
        const monthly = row.original.monthly;
        const isAllToPartnerX = row.original.exp.benefit_x >= 100;
        const isAllToPartnerY = row.original.exp.benefit_x <= 0;
        const isSingleBeneficiary = isAllToPartnerX || isAllToPartnerY;
        const beneficiaryLabel = isAllToPartnerX ? partnerX : partnerY;
        const benefitX = row.original.exp.benefit_x / 100;
        const benefitY = 1 - benefitX;
        const isEvenBenefitSplit = Math.abs(row.original.exp.benefit_x - 50) < 0.0001;
        const incomeXRatio = incomeRatioX;
        const incomeYRatio = incomeRatioY;
        const weightX = benefitX * incomeXRatio;
        const weightY = benefitY * incomeYRatio;
        const totalWeight = weightX + weightY || 1;
        const normalizedShareX = weightX / totalWeight;
        const value = Number(getValue());
        const renderedStepCount = (shouldShowNormalizationStep ? 1 : 0)
          + (isWageGapApplied ? 1 : 0)
          + ((isSingleBeneficiary || isEvenBenefitSplit) ? 1 : 4);
        const hasSingleStep = renderedStepCount === 1;
        const stepPrefix = (step: number) => (hasSingleStep ? '' : `${step}. `);
        const baseStep = shouldShowNormalizationStep ? 2 : 1;
        const normalizedStep = isWageGapApplied ? baseStep + 1 : baseStep;

        return (
          <PersistentTooltipText
            align="end"
            side="top"
            contentClassName="[--tooltip-content-max-width:460px] text-xs tabular-nums"
            content={(
              <div className="space-y-1.5 text-left">
                <div className="font-medium">{partnerX} fair share, step by step:</div>
                {shouldShowNormalizationStep && (
                  <div>{stepPrefix(1)}Convert the original expense to its monthly equivalent: ${originalAmount.toFixed(2)} {frequencyDescription.toLowerCase()} converts to ${monthly.toFixed(2)} per month.</div>
                )}
                {isWageGapApplied && (
                  <div>
                    {stepPrefix(baseStep)}Apply wage gap normalization to income shares: {partnerX} ${Math.round(incomeNormalization.incomeX)} × {Math.round(incomeNormalization.partnerXFactor * 100)}% = ${Math.round(incomeNormalization.adjustedIncomeX)}, {partnerY} ${Math.round(incomeNormalization.incomeY)} × {Math.round(incomeNormalization.partnerYFactor * 100)}% = ${Math.round(incomeNormalization.adjustedIncomeY)}. Adjusted income ratios are {Math.round(incomeXRatio * 100)}% / {Math.round(incomeYRatio * 100)}%.
                  </div>
                )}
                {isSingleBeneficiary ? (
                  <div>{stepPrefix(normalizedStep)}Benefit split is {row.original.exp.benefit_x}/
                    {100 - row.original.exp.benefit_x}, so this expense is assigned entirely to {beneficiaryLabel}. {partnerX === beneficiaryLabel ? `${partnerX} gets 100% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).` : `${partnerX} gets 0% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).`}
                  </div>
                ) : isEvenBenefitSplit ? (
                  <div>{stepPrefix(normalizedStep)}Benefit is exactly 50/50, so just multiply the monthly amount by {partnerX}&apos;s {isWageGapApplied ? 'wage gap-adjusted income ratio' : 'income ratio'}: ${monthly.toFixed(2)} × {formatPercent(incomeXRatio)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                ) : (
                  <>
                    <div>{stepPrefix(normalizedStep)}Calculate {partnerX}&apos;s weight by combining benefit and {isWageGapApplied ? 'wage gap-adjusted income share' : 'income share'}: {(benefitX * 100).toFixed(1)}% × {(incomeXRatio * 100).toFixed(1)}% = {weightX.toFixed(4)}.</div>
                    <div>{stepPrefix(normalizedStep + 1)}Calculate total weight for both partners: {weightX.toFixed(4)} + {weightY.toFixed(4)} = {totalWeight.toFixed(4)}.</div>
                    <div>{stepPrefix(normalizedStep + 2)}Convert {partnerX}&apos;s weight to a fraction of the total: {weightX.toFixed(4)} / {totalWeight.toFixed(4)} = {(normalizedShareX * 100).toFixed(2)}%.</div>
                    <div>{stepPrefix(normalizedStep + 3)}Apply that fraction to the monthly amount: ${monthly.toFixed(2)} × {(normalizedShareX * 100).toFixed(2)}% = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                  </>
                )}
              </div>
            )}
          >
            {`$${Math.round(value)}`}
          </PersistentTooltipText>
        );
      },
    }),
    columnHelper.accessor('fairY', {
      id: 'fair_y',
      header: `Fair ${partnerY}`,
      size: EXPENSES_GRID_DEFAULT_WIDTHS.fair_y,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { headerClassName: 'text-right', cellClassName: `text-right tabular-nums text-xs ${GRID_READONLY_TEXT_CLASS}` },
      cell: ({ getValue, row }) => {
        const originalAmount = Number(row.original.exp.amount);
        const shouldShowNormalizationStep = row.original.exp.frequency_type !== 'monthly';
        const frequencyDescription = formatFrequencyDescription(row.original.exp.frequency_type, row.original.exp.frequency_param);
        const monthly = row.original.monthly;
        const isAllToPartnerX = row.original.exp.benefit_x >= 100;
        const isAllToPartnerY = row.original.exp.benefit_x <= 0;
        const isSingleBeneficiary = isAllToPartnerX || isAllToPartnerY;
        const beneficiaryLabel = isAllToPartnerX ? partnerX : partnerY;
        const benefitX = row.original.exp.benefit_x / 100;
        const benefitY = 1 - benefitX;
        const isEvenBenefitSplit = Math.abs(row.original.exp.benefit_x - 50) < 0.0001;
        const incomeXRatio = incomeRatioX;
        const incomeYRatio = incomeRatioY;
        const weightX = benefitX * incomeXRatio;
        const weightY = benefitY * incomeYRatio;
        const totalWeight = weightX + weightY || 1;
        const normalizedShareY = weightY / totalWeight;
        const value = Number(getValue());
        const renderedStepCount = (shouldShowNormalizationStep ? 1 : 0)
          + (isWageGapApplied ? 1 : 0)
          + ((isSingleBeneficiary || isEvenBenefitSplit) ? 1 : 4);
        const hasSingleStep = renderedStepCount === 1;
        const stepPrefix = (step: number) => (hasSingleStep ? '' : `${step}. `);
        const baseStep = shouldShowNormalizationStep ? 2 : 1;
        const normalizedStep = isWageGapApplied ? baseStep + 1 : baseStep;

        return (
          <PersistentTooltipText
            align="end"
            side="top"
            contentClassName="[--tooltip-content-max-width:460px] text-xs tabular-nums"
            content={(
              <div className="space-y-1.5 text-left">
                <div className="font-medium">{partnerY} fair share, step by step:</div>
                {shouldShowNormalizationStep && (
                  <div>{stepPrefix(1)}Convert the original expense to its monthly equivalent: ${originalAmount.toFixed(2)} {frequencyDescription.toLowerCase()} converts to ${monthly.toFixed(2)} per month.</div>
                )}
                {isWageGapApplied && (
                  <div>
                    {stepPrefix(baseStep)}Apply wage gap normalization to income shares: {partnerX} ${Math.round(incomeNormalization.incomeX)} × {Math.round(incomeNormalization.partnerXFactor * 100)}% = ${Math.round(incomeNormalization.adjustedIncomeX)}, {partnerY} ${Math.round(incomeNormalization.incomeY)} × {Math.round(incomeNormalization.partnerYFactor * 100)}% = ${Math.round(incomeNormalization.adjustedIncomeY)}. Adjusted income ratios are {Math.round(incomeXRatio * 100)}% / {Math.round(incomeYRatio * 100)}%.
                  </div>
                )}
                {isSingleBeneficiary ? (
                  <div>{stepPrefix(normalizedStep)}Benefit split is {row.original.exp.benefit_x}/
                    {100 - row.original.exp.benefit_x}, so this expense is assigned entirely to {beneficiaryLabel}. {partnerY === beneficiaryLabel ? `${partnerY} gets 100% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).` : `${partnerY} gets 0% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).`}
                  </div>
                ) : isEvenBenefitSplit ? (
                  <div>{stepPrefix(normalizedStep)}Benefit is exactly 50/50, so just multiply the monthly amount by {partnerY}&apos;s {isWageGapApplied ? 'wage gap-adjusted income ratio' : 'income ratio'}: ${monthly.toFixed(2)} × {formatPercent(incomeYRatio)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                ) : (
                  <>
                    <div>{stepPrefix(normalizedStep)}Calculate {partnerY}&apos;s weight by combining benefit and {isWageGapApplied ? 'wage gap-adjusted income share' : 'income share'}: {(benefitY * 100).toFixed(1)}% × {(incomeYRatio * 100).toFixed(1)}% = {weightY.toFixed(4)}.</div>
                    <div>{stepPrefix(normalizedStep + 1)}Calculate total weight for both partners: {weightX.toFixed(4)} + {weightY.toFixed(4)} = {totalWeight.toFixed(4)}.</div>
                    <div>{stepPrefix(normalizedStep + 2)}Convert {partnerY}&apos;s weight to a fraction of the total: {weightY.toFixed(4)} / {totalWeight.toFixed(4)} = {(normalizedShareY * 100).toFixed(2)}%.</div>
                    <div>{stepPrefix(normalizedStep + 3)}Apply that fraction to the monthly amount: ${monthly.toFixed(2)} × {(normalizedShareY * 100).toFixed(2)}% = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                  </>
                )}
              </div>
            )}
          >
            {`$${Math.round(value)}`}
          </PersistentTooltipText>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      enableResizing: false,
      size: EXPENSES_GRID_DEFAULT_WIDTHS.actions,
      minSize: EXPENSES_GRID_DEFAULT_WIDTHS.actions,
      maxSize: EXPENSES_GRID_DEFAULT_WIDTHS.actions,
      meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
      cell: ({ row }) => (
        <ExpenseActionsCell
          expense={row.original.exp}
          onRemove={() => handleRemove(row.original.exp.id)}
          onConvert={handleConvert}
          disabled={!!pendingById[row.original.exp.id]}
        />
      ),
    }),
  ], [categories, linkedAccounts, partnerX, partnerY, getDerivedPayer, incomeNormalization, incomeRatioX, incomeRatioY, isWageGapApplied, pendingById]);

  const table = useReactTable({
    data: computedData,
    columns,
    defaultColumn: { minSize: GRID_MIN_COLUMN_WIDTH },
    state: { sorting, columnSizing, columnSizingInfo },
    enableColumnResizing: true,
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.exp.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ─── Grouping ───

  const getGroupKey = useMemo(() => {
    if (groupBy === 'none') return undefined;
    return (row: ComputedRow): string => {
      switch (groupBy) {
        case 'category': return row.exp.category_id ?? '_ungrouped';
        case 'estimated': return row.exp.is_estimate ? 'Estimated' : 'Actual';
        case 'payer': return getDerivedPayer(row.exp) ?? '_ungrouped';
        case 'payment_method': return row.exp.linked_account_id ?? '_ungrouped';
        default: return '_all';
      }
    };
  }, [groupBy, getDerivedPayer]);

  const getGroupLabel = (key: string): string => {
    if (key === '_ungrouped') return 'Uncategorized';
    switch (groupBy) {
      case 'category': return categories.find(c => c.id === key)?.name ?? 'Uncategorized';
      case 'estimated': return key;
      case 'payer': return key === 'X' ? partnerX : key === 'Y' ? partnerY : 'Unassigned';
      case 'payment_method': return linkedAccounts.find(la => la.id === key)?.name ?? 'Uncategorized';
      default: return '';
    }
  };

  const groupOrder = useMemo(() => {
    if (groupBy !== 'category' && groupBy !== 'payer' && groupBy !== 'payment_method') return undefined;
    return (aKey: string, bKey: string) =>
      getGroupLabel(aKey).localeCompare(getGroupLabel(bKey), undefined, { sensitivity: 'base', numeric: true });
  }, [groupBy, categories, linkedAccounts, partnerX, partnerY]);

  const renderGroupHeader = (key: string, groupRows: Row<ComputedRow>[]) => {
    const gMonthly = groupRows.reduce((s, r) => s + r.original.monthly, 0);
    const gFairX = groupRows.reduce((s, r) => s + r.original.fairX, 0);
    const gFairY = groupRows.reduce((s, r) => s + r.original.fairY, 0);
    const groupRowBgClass = 'bg-[hsl(var(--category-group-row-bg))]';
    const groupRowTextClass = 'text-white';
    const groupRowFontClass = 'font-medium';
    const groupRowCellClass = `${groupRowBgClass} h-7 align-middle shadow-[inset_0_1px_0_0_hsl(var(--category-group-row-bg)),inset_0_-1px_0_0_hsl(var(--category-group-row-bg))]`;
    const groupRowTextCellClass = `${groupRowFontClass} text-xs leading-none`;
    return (
      <tr
        key={`gh-${key}`}
        className={`${groupRowBgClass} ${groupRowTextClass} border-b-0 ${fullView ? 'sticky top-[36px] z-30' : ''}`}
      >
        <td className={`${groupRowCellClass} ${groupRowTextCellClass} px-2 sticky left-0 z-30 relative shadow-[inset_0_1px_0_0_hsl(var(--category-group-row-bg)),inset_0_-1px_0_0_hsl(var(--category-group-row-bg))] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[hsl(var(--grid-sticky-line))]`}>{getGroupLabel(key)} ({groupRows.length})</td>
        <td colSpan={4} className={groupRowCellClass} />
        <td className={`${groupRowCellClass} ${groupRowTextCellClass} text-right tabular-nums px-2`}>
          <PersistentTooltipText
            align="end"
            side="top"
            contentClassName="text-xs tabular-nums"
            content={normalizedMonthlyTooltipContent(gMonthly)}
          >
            {`$${Math.round(gMonthly)}`}
          </PersistentTooltipText>
        </td>
        <td colSpan={4} className={groupRowCellClass} />
        <td className={`${groupRowCellClass} ${groupRowTextCellClass} text-right tabular-nums px-2`}>${Math.round(gFairX)}</td>
        <td className={`${groupRowCellClass} ${groupRowTextCellClass} text-right tabular-nums px-2`}>${Math.round(gFairY)}</td>
        <td
          className={`${groupRowCellClass} sticky right-0 z-30 relative after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-[hsl(var(--grid-sticky-line))]`}
        />
      </tr>
    );
  };

  const dialogTitle = addDialog === 'category' ? 'New Category' : 'New Payment Method';
  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'px-0 pb-2.5';

  return (
    <Card className={`max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 ${fullView ? 'h-full min-h-0 flex flex-col border-t-0 md:border-t' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Expenses</CardTitle>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isMobile ? (
              <>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={openViewControlsModal}>
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                {hasActiveViewControls && (
                  <Button
                    type="button"
                    variant="outline-warning"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={clearViewControls}
                    aria-label="Clear filters and groupings"
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Select value={filterPayer} onValueChange={v => setFilterPayer(v as PayerFilter)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All partners</SelectItem>
                    <SelectItem value="X">{partnerX} only</SelectItem>
                    <SelectItem value="Y">{partnerY} only</SelectItem>
                    <SelectItem value="unassigned">Unassigned only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupByOption)}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Group by…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No grouping</SelectItem>
                    <SelectItem value="category">Group by Category</SelectItem>
                    <SelectItem value="estimated">Group by Estimated</SelectItem>
                    <SelectItem value="payer">Group by Payer</SelectItem>
                    <SelectItem value="payment_method">Group by Payment Method</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveViewControls && (
                  <Button
                    type="button"
                    variant="outline-warning"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={clearViewControls}
                    aria-label="Clear filters and groupings"
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            <Button onClick={openAddExpenseModal} disabled={savingExpense} variant="outline-success" size="sm" className="h-8 w-8 p-0" aria-label="Add expense">
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
          emptyMessage={emptyExpensesMessage}
          groupBy={getGroupKey}
          renderGroupHeader={renderGroupHeader}
          groupOrder={groupOrder}
          footer={computedData.length > 0 ? (
            <tr className={`${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS}`}>
              <td className={`h-9 align-middle font-semibold text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>Totals</td>
              <td colSpan={4} className={GRID_HEADER_TONE_CLASS} />
              <td className={`h-9 align-middle text-right font-semibold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>
                <PersistentTooltipText
                  align="end"
                  side="top"
                  contentClassName="text-xs tabular-nums"
                  content={normalizedMonthlyTooltipContent(totalMonthly)}
                >
                  {`$${Math.round(totalMonthly)}`}
                </PersistentTooltipText>
              </td>
              <td colSpan={4} className={GRID_HEADER_TONE_CLASS} />
              <td className={`h-9 align-middle text-right font-semibold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>${Math.round(totalFairX)}</td>
              <td className={`h-9 align-middle text-right font-semibold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>${Math.round(totalFairY)}</td>
              <td className={GRID_HEADER_TONE_CLASS} />
            </tr>
          ) : undefined}
        />
      </CardContent>

      <Dialog
        open={addExpenseOpen}
        onOpenChange={open => {
          if (!open && !savingExpense) {
            setAddExpenseOpen(false);
            setNewExpense(createDefaultExpenseDraft());
          }
        }}
      >
        <DialogContent
          className={`sm:max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col ${savingExpense ? '[&>button]:pointer-events-none [&>button]:opacity-50' : ''}`}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto shadow-[inset_0_5px_6px_-6px_hsl(var(--foreground)/0.25),inset_0_-5px_6px_-6px_hsl(var(--foreground)/0.25)]">
            <div className="space-y-3">
              <div className="space-y-1.5">
              <DataGridAddFormLabel htmlFor="new-expense-name">Name</DataGridAddFormLabel>
              <Input
                id="new-expense-name"
                value={newExpense.name}
                onChange={e => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
                disabled={savingExpense}
              />
            </div>

              <div className="space-y-1.5">
              <DataGridAddFormLabel>Category</DataGridAddFormLabel>
              <Select
                value={newExpense.category_id ?? '_none'}
                onValueChange={v => {
                  if (v === '_add_new') {
                    openNewItemDialog({ type: 'new_expense', field: 'category_id' }, 'category');
                    return;
                  }
                  setNewExpense(prev => ({ ...prev, category_id: v === '_none' ? null : v }));
                }}
                disabled={savingExpense}
              >
                <SelectTrigger
                  style={{ backgroundColor: normalizePaletteColor(categories.find(c => c.id === newExpense.category_id)?.color) || 'transparent' }}
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id} rightAdornment={<DropdownOptionColorSwatch color={c.color} />}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="_add_new" className="text-primary font-medium"><Plus className="inline h-3 w-3 mr-1" />Add New</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div className="space-y-1.5">
              <DataGridAddFormLabel>Payment Method</DataGridAddFormLabel>
              <Select
                value={newExpense.linked_account_id ?? '_none'}
                onValueChange={v => {
                  if (v === '_add_new') {
                    openNewItemDialog({ type: 'new_expense', field: 'linked_account_id' }, 'payment_method');
                    return;
                  }
                  setNewExpense(prev => ({ ...prev, linked_account_id: v === '_none' ? null : v }));
                }}
                disabled={savingExpense}
              >
                <SelectTrigger
                  style={{ backgroundColor: normalizePaletteColor(linkedAccounts.find(la => la.id === newExpense.linked_account_id)?.color) || 'transparent' }}
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {linkedAccounts.map(la => (
                    <SelectItem key={la.id} value={la.id} rightAdornment={<DropdownOptionColorSwatch color={la.color} />}>
                      {la.name} <span className="text-muted-foreground">({la.owner_partner === 'X' ? partnerX : partnerY})</span>
                    </SelectItem>
                  ))}
                  <SelectItem value="_add_new" className="text-primary font-medium"><Plus className="inline h-3 w-3 mr-1" />Add New</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <DataGridAddFormLabel htmlFor="new-expense-benefit-x" tooltip={`The percentage that ${partnerX} benefits from the expense`} tooltipTabStop={false}>
                    {partnerX} Benefit
                  </DataGridAddFormLabel>
                  <DataGridAddFormAffixInput
                    id="new-expense-benefit-x"
                    suffix="%"
                    min={0}
                    max={100}
                    value={String(newExpense.benefit_x)}
                    onChange={e => {
                      const clamped = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                      setNewExpense(prev => ({ ...prev, benefit_x: clamped }));
                    }}
                    disabled={savingExpense}
                  />
                </div>
                <div className="space-y-1.5">
                  <DataGridAddFormLabel htmlFor="new-expense-benefit-y" tooltip={`The percentage that ${partnerY} benefits from the expense`} tooltipTabStop={false}>
                    {partnerY} Benefit
                  </DataGridAddFormLabel>
                  <DataGridAddFormAffixInput
                    id="new-expense-benefit-y"
                    suffix="%"
                    min={0}
                    max={100}
                    value={String(100 - newExpense.benefit_x)}
                    onChange={e => {
                      const clamped = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                      setNewExpense(prev => ({ ...prev, benefit_x: 100 - clamped }));
                    }}
                    disabled={savingExpense}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <DataGridAddFormLabel>Type</DataGridAddFormLabel>
                <Select
                  value={newExpense.value_type}
                  onValueChange={(value) => handleNewExpenseTypeChange(value as BudgetValueType)}
                  disabled={savingExpense}
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

              {newExpense.value_type === 'simple' ? (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <div className="space-y-1.5">
                      <DataGridAddFormLabel htmlFor="new-expense-amount">Amount</DataGridAddFormLabel>
                      <DataGridAddFormAffixInput
                        id="new-expense-amount"
                        prefix="$"
                        value={newExpense.amount === 0 ? '' : String(newExpense.amount)}
                        onChange={e => setNewExpense(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                        disabled={savingExpense}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <DataGridAddFormLabel htmlFor="new-expense-estimate" tooltip="Estimated means this value was manually marked as estimated." tooltipTabStop={false}>Estimated</DataGridAddFormLabel>
                      <div className="h-9 flex items-center -translate-y-0.5">
                        <Checkbox
                          id="new-expense-estimate"
                          checked={newExpense.is_estimate}
                          onCheckedChange={checked => setNewExpense(prev => ({ ...prev, is_estimate: !!checked }))}
                          disabled={savingExpense}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <DataGridAddFormLabel>Frequency</DataGridAddFormLabel>
                    <div className="flex items-center gap-2">
                      <Select
                        value={newExpense.frequency_type}
                        onValueChange={v => {
                          const nextFreq = v as FrequencyType;
                          setNewExpense(prev => ({
                            ...prev,
                            frequency_type: nextFreq,
                            frequency_param: needsParam(nextFreq) ? prev.frequency_param : null,
                          }));
                        }}
                        disabled={savingExpense}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FREQ_OPTIONS.map(f => <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {needsParam(newExpense.frequency_type) && (
                        <Input
                          type="number"
                          value={newExpense.frequency_param == null ? '' : String(newExpense.frequency_param)}
                          onChange={e => setNewExpense(prev => ({ ...prev, frequency_param: e.target.value ? Number(e.target.value) : null }))}
                          disabled={savingExpense}
                          className="h-9 w-24"
                          placeholder="X"
                        />
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <AverageRecordsEditor
                  valueType={newExpense.value_type}
                  records={newExpense.average_records}
                  onChange={records => setNewExpense(prev => ({ ...prev, average_records: records }))}
                  disabled={savingExpense}
                />
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddExpenseOpen(false);
                setNewExpense(createDefaultExpenseDraft());
              }}
              disabled={savingExpense}
            >
              Cancel
            </Button>
            <Button variant="outline-success" onClick={handleSaveNewExpense} disabled={savingExpense}>{savingExpense ? 'Saving...' : 'Add'}</Button>
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
            <Button variant="outline-success" onClick={handleSaveAverageEditor} disabled={savingAverageEditor}>{savingAverageEditor ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={convertToSimpleState !== null} onOpenChange={open => { if (!open && !savingConvertToSimple) setConvertToSimpleState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to simple expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the current averaged amount and removes the contributing records. The converted expense will be marked as estimated.
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

      <Dialog open={viewControlsOpen} onOpenChange={setViewControlsOpen}>
        <DialogContent className="w-screen max-w-none rounded-none sm:w-full sm:max-w-sm sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Filters & View Settings</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label>Partner Filter</Label>
              <Select value={draftFilterPayer} onValueChange={v => setDraftFilterPayer(v as PayerFilter)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All partners</SelectItem>
                  <SelectItem value="X">{partnerX} only</SelectItem>
                  <SelectItem value="Y">{partnerY} only</SelectItem>
                  <SelectItem value="unassigned">Unassigned only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group By</Label>
              <Select value={draftGroupBy} onValueChange={v => setDraftGroupBy(v as GroupByOption)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Group by…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="category">Group by Category</SelectItem>
                  <SelectItem value="estimated">Group by Estimated</SelectItem>
                  <SelectItem value="payer">Group by Payer</SelectItem>
                  <SelectItem value="payment_method">Group by Payment Method</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewControlsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyViewControls}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialog !== null} onOpenChange={open => { if (!open && !savingItem) { setAddDialog(null); setAddSource(null); } }}>
        <DialogContent
          className={`sm:max-w-sm ${savingItem ? '[&>button]:pointer-events-none [&>button]:opacity-50' : ''}`}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3 shadow-[inset_0_5px_6px_-6px_hsl(var(--foreground)/0.25),inset_0_-5px_6px_-6px_hsl(var(--foreground)/0.25)]">
            <div className="space-y-1.5">
              <Label htmlFor="new-item-name">Name</Label>
              <Input id="new-item-name" value={newItemName} onChange={e => setNewItemName(e.target.value)} autoFocus disabled={savingItem} onKeyDown={e => { if (e.key === 'Enter' && !savingItem) handleSaveNewItem(); }} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <ColorPicker color={newItemColor} onChange={setNewItemColor} disabled={savingItem} />
                <span className="text-xs text-muted-foreground">{newItemColor ? (COLOR_LABELS[normalizePaletteColor(newItemColor) ?? newItemColor] ?? 'Custom color') : 'None'}</span>
              </div>
            </div>
            {addDialog === 'payment_method' && (
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Select value={newItemOwner} onValueChange={v => setNewItemOwner(v as 'X' | 'Y')} disabled={savingItem}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X">{partnerX}</SelectItem>
                    <SelectItem value="Y">{partnerY}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialog(null); setAddSource(null); }} disabled={savingItem}>Cancel</Button>
            <Button variant="outline-success" onClick={handleSaveNewItem} disabled={savingItem || !newItemName.trim()}>{savingItem ? 'Saving...' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
