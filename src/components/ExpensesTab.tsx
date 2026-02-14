import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSpreadsheetNav } from '@/hooks/useSpreadsheetNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toMonthly, frequencyLabels } from '@/lib/frequency';
import type { FrequencyType } from '@/types/fairshare';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';
import type { Budget } from '@/hooks/useBudgets';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Income } from '@/hooks/useIncomes';

interface ExpensesTabProps {
  expenses: Expense[];
  categories: Category[];
  budgets: Budget[];
  linkedAccounts: LinkedAccount[];
  incomes: Income[];
  partnerX: string;
  partnerY: string;
  partnerXColor: string | null;
  partnerYColor: string | null;
  onAdd: (expense: Omit<Expense, 'id' | 'household_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const FREQ_OPTIONS: FrequencyType[] = ['monthly', 'twice_monthly', 'weekly', 'every_n_weeks', 'annual', 'k_times_annually'];
const NEEDS_PARAM: Set<FrequencyType> = new Set(['every_n_weeks', 'k_times_annually']);

type GroupByOption = 'none' | 'category' | 'budget' | 'payer' | 'payment_method';
type SortColumn = 'name' | 'category' | 'amount' | 'estimate' | 'frequency' | 'param' | 'monthly' | 'budget' | 'payment_method' | 'payer' | 'benefit_x' | 'benefit_y' | 'fair_x' | 'fair_y';
type SortDir = 'asc' | 'desc';

function SortableHead({ column, label, current, dir, onSort, className = '' }: {
  column: SortColumn;
  label: React.ReactNode;
  current: SortColumn;
  dir: SortDir;
  onSort: (col: SortColumn) => void;
  className?: string;
}) {
  const active = current === column;
  return (
    <TableHead className={`${className} cursor-pointer select-none hover:bg-muted/50`} onClick={() => onSort(column)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </TableHead>
  );
}

function EditableCell({ value, onChange, type = 'text', className = '', min, max, step, 'data-row': dataRow, 'data-col': dataCol, onCellKeyDown, onCellMouseDown }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  'data-row'?: number;
  'data-col'?: number;
  onCellKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  onCellMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <Input
      ref={ref}
      type={type}
      value={local}
      min={min}
      max={max}
      step={step}
      data-row={dataRow}
      data-col={dataCol}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (onCellKeyDown) onCellKeyDown(e);
        else if (e.key === 'Enter') ref.current?.blur();
      }}
      onMouseDown={onCellMouseDown}
      className={`h-7 border-transparent bg-transparent px-1 hover:border-border focus:border-primary !text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}

function CurrencyCell({ value, onChange, className = '', 'data-row': dataRow, 'data-col': dataCol, onCellKeyDown, onCellMouseDown }: {
  value: number;
  onChange: (v: string) => void;
  className?: string;
  'data-row'?: number;
  'data-col'?: number;
  onCellKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  onCellMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const [local, setLocal] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <div className="min-w-[5rem]">
      {focused ? (
        <Input
          ref={ref}
          type="number"
          value={local}
          data-row={dataRow}
          data-col={dataCol}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { commit(); setFocused(false); }}
          onKeyDown={e => {
            if (onCellKeyDown) onCellKeyDown(e);
            else if (e.key === 'Enter') ref.current?.blur();
          }}
          onMouseDown={onCellMouseDown}
          autoFocus
          className={`h-7 w-full border-transparent bg-transparent px-1 hover:border-border focus:border-primary !text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        />
      ) : (
        <button
          type="button"
          data-row={dataRow}
          data-col={dataCol}
          onClick={() => setFocused(true)}
          onMouseDown={onCellMouseDown}
          className={`h-7 w-full bg-transparent px-1 !text-xs text-right cursor-text border border-transparent hover:border-border rounded-md underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${className}`}
        >
          ${Math.round(Number(local) || 0)}
        </button>
      )}
    </div>
  );
}

function PercentCell({ value, onChange, className = '', 'data-row': dataRow, 'data-col': dataCol, onCellKeyDown, onCellMouseDown, min = 0, max = 100 }: {
  value: number;
  onChange: (v: string) => void;
  className?: string;
  'data-row'?: number;
  'data-col'?: number;
  onCellKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  onCellMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
  min?: number;
  max?: number;
}) {
  const [local, setLocal] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setLocal(String(value));
  }, [value, focused]);

  const commit = () => { if (local !== String(value)) onChange(local); };

  return (
    <div className="min-w-[4rem]">
      {focused ? (
        <Input
          ref={ref}
          type="number"
          value={local}
          min={min}
          max={max}
          data-row={dataRow}
          data-col={dataCol}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { commit(); setFocused(false); }}
          onKeyDown={e => {
            if (onCellKeyDown) onCellKeyDown(e);
            else if (e.key === 'Enter') ref.current?.blur();
          }}
          onMouseDown={onCellMouseDown}
          autoFocus
          className={`h-7 w-full border-transparent bg-transparent px-1 hover:border-border focus:border-primary !text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        />
      ) : (
        <button
          type="button"
          data-row={dataRow}
          data-col={dataCol}
          onClick={() => setFocused(true)}
          onMouseDown={onCellMouseDown}
          className={`h-7 w-full bg-transparent px-1 !text-xs text-right cursor-text border border-transparent hover:border-border rounded-md underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${className}`}
        >
          {Math.round(Number(local) || 0)}%
        </button>
      )}
    </div>
  );
}

interface ComputedRow {
  exp: Expense;
  fairX: number;
  fairY: number;
  monthly: number;
}

function ExpenseRow({ exp, fairX, fairY, monthly, categories, budgets, linkedAccounts, partnerX, partnerY, partnerXColor, partnerYColor, handleUpdate, handleToggleEstimate, handleRemove, rowIndex, onCellKeyDown, onCellMouseDown }: ComputedRow & {
  categories: Category[];
  budgets: Budget[];
  linkedAccounts: LinkedAccount[];
  partnerX: string;
  partnerY: string;
  partnerXColor: string | null;
  partnerYColor: string | null;
  handleUpdate: (id: string, field: string, value: string) => void;
  handleToggleEstimate: (id: string, checked: boolean) => void;
  handleRemove: (id: string) => void;
  rowIndex: number;
  onCellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onCellMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const [localBenefitX, setLocalBenefitX] = useState(exp.benefit_x);

  useEffect(() => {
    setLocalBenefitX(exp.benefit_x);
  }, [exp.benefit_x]);

  const handleBenefitXChange = (v: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    setLocalBenefitX(clamped);
    handleUpdate(exp.id, 'benefit_x', String(clamped));
  };

  const handleBenefitYChange = (v: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const newX = 100 - clamped;
    setLocalBenefitX(newX);
    handleUpdate(exp.id, 'benefit_x', String(newX));
  };

  const nav = { onCellKeyDown, onCellMouseDown };

  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 bg-background">
        <EditableCell value={exp.name} onChange={v => handleUpdate(exp.id, 'name', v)} data-row={rowIndex} data-col={0} {...nav} />
      </TableCell>
      <TableCell>
        <Select value={exp.category_id ?? '_none'} onValueChange={v => handleUpdate(exp.id, 'category_id', v)}>
          <SelectTrigger
            className="h-7 border-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm"
            style={{ backgroundColor: categories.find(c => c.id === exp.category_id)?.color || 'transparent' }}
            data-row={rowIndex} data-col={1} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <CurrencyCell value={Number(exp.amount)} onChange={v => handleUpdate(exp.id, 'amount', v)} className="text-right" data-row={rowIndex} data-col={2} {...nav} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={exp.is_estimate} onCheckedChange={(checked) => handleToggleEstimate(exp.id, !!checked)} data-row={rowIndex} data-col={3} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown} />
      </TableCell>
      <TableCell>
        <Select value={exp.frequency_type} onValueChange={v => handleUpdate(exp.id, 'frequency_type', v)}>
          <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2" data-row={rowIndex} data-col={4} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQ_OPTIONS.map(f => (
              <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {NEEDS_PARAM.has(exp.frequency_type) ? (
          <EditableCell value={exp.frequency_param ?? ''} onChange={v => handleUpdate(exp.id, 'frequency_param', v)} type="number" className="text-right w-16" data-row={rowIndex} data-col={5} {...nav} />
        ) : (
          <span className="text-muted-foreground text-xs px-1">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums text-xs">${Math.round(monthly)}</TableCell>
      <TableCell>
        <Select value={exp.budget_id ?? '_none'} onValueChange={v => handleUpdate(exp.id, 'budget_id', v)}>
          <SelectTrigger
            className="h-7 border-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm"
            style={{ backgroundColor: budgets.find(b => b.id === exp.budget_id)?.color || 'transparent' }}
            data-row={rowIndex} data-col={7} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            {budgets.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={exp.linked_account_id ?? '_none'} onValueChange={v => handleUpdate(exp.id, 'linked_account_id', v)}>
          <SelectTrigger
            className="h-7 border-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm"
            style={{ backgroundColor: linkedAccounts.find(la => la.id === exp.linked_account_id)?.color || 'transparent' }}
            data-row={rowIndex} data-col={8} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}
          >
            <SelectValue>
              {exp.linked_account_id ? linkedAccounts.find(la => la.id === exp.linked_account_id)?.name ?? '—' : '—'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            {linkedAccounts.map(la => (
              <SelectItem key={la.id} value={la.id}>
                {la.name} <span className="text-muted-foreground">({la.owner_partner === 'X' ? partnerX : partnerY})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <span
          className="text-xs px-1.5 py-0.5 rounded-sm"
          style={{ backgroundColor: (exp.payer === 'X' ? partnerXColor : partnerYColor) || 'transparent' }}
        >
          {exp.payer === 'X' ? partnerX : partnerY}
        </span>
      </TableCell>
      <TableCell>
        <PercentCell value={localBenefitX} onChange={handleBenefitXChange} className="text-right w-16" min={0} max={100} data-row={rowIndex} data-col={10} {...nav} />
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        <PercentCell value={100 - localBenefitX} onChange={handleBenefitYChange} className="text-right w-16" min={0} max={100} data-row={rowIndex} data-col={11} {...nav} />
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">${Math.round(fairX)}</TableCell>
      <TableCell className="text-right tabular-nums text-xs">${Math.round(fairY)}</TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete expense</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{exp.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRemove(exp.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
function GroupSubtotalRow({ label, rows }: { label: string; rows: ComputedRow[] }) {
  const groupMonthly = rows.reduce((s, r) => s + r.monthly, 0);
  const groupFairX = rows.reduce((s, r) => s + r.fairX, 0);
  const groupFairY = rows.reduce((s, r) => s + r.fairY, 0);
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={6} className="sticky left-0 z-10 bg-muted/30 font-semibold text-xs">
        {label}
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums text-xs">${Math.round(groupMonthly)}</TableCell>
      <TableCell colSpan={5} />
      <TableCell className="text-right font-semibold tabular-nums text-xs">${Math.round(groupFairX)}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums text-xs">${Math.round(groupFairY)}</TableCell>
      <TableCell />
    </TableRow>
  );
}

export function ExpensesTab({ expenses, categories, budgets, linkedAccounts, incomes, partnerX, partnerY, partnerXColor, partnerYColor, onAdd, onUpdate, onRemove }: ExpensesTabProps) {
  const [adding, setAdding] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => (localStorage.getItem('expenses_groupBy') as GroupByOption) || 'none');
  const [sortCol, setSortCol] = useState<SortColumn>(() => (localStorage.getItem('expenses_sortCol') as SortColumn) || 'name');
  const [sortDir, setSortDir] = useState<SortDir>(() => (localStorage.getItem('expenses_sortDir') as SortDir) || 'asc');

  useEffect(() => { localStorage.setItem('expenses_groupBy', groupBy); }, [groupBy]);
  useEffect(() => { localStorage.setItem('expenses_sortCol', sortCol); }, [sortCol]);
  useEffect(() => { localStorage.setItem('expenses_sortDir', sortDir); }, [sortDir]);

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Compute income ratio
  const incomeX = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const incomeY = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const totalIncome = incomeX + incomeY;
  const incomeRatioX = totalIncome > 0 ? incomeX / totalIncome : 0.5;

  const computeFairShare = (exp: Expense) => {
    const monthly = toMonthly(exp.amount, exp.frequency_type, exp.frequency_param ?? undefined);
    const bx = exp.benefit_x / 100;
    const by = 1 - bx;
    const wx = bx * incomeRatioX;
    const wy = by * (1 - incomeRatioX);
    const tw = wx + wy || 1;
    return { fairX: monthly * (wx / tw), fairY: monthly * (wy / tw), monthly };
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAdd({
        name: '',
        amount: 0,
        payer: 'X',
        benefit_x: 50,
        category_id: null,
        budget_id: null,
        linked_account_id: null,
        frequency_type: 'monthly',
        frequency_param: null,
        is_estimate: false,
      });
      // Focus the name cell of the newly added row after render
      requestAnimationFrame(() => {
        const table = tableRef.current;
        if (!table) return;
        const allNameCells = table.querySelectorAll<HTMLElement>('[data-col="0"]');
        const last = allNameCells[allNameCells.length - 1];
        if (last) last.click();
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleUpdate = async (id: string, field: string, value: string) => {
    try {
      const updates: any = {};
      if (field === 'name') updates.name = value;
      else if (field === 'amount') updates.amount = Number(value) || 0;
      else if (field === 'benefit_x') updates.benefit_x = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      else if (field === 'frequency_param') updates.frequency_param = value ? Number(value) : null;
      else if (field === 'category_id') updates.category_id = value === '_none' ? null : value;
      else if (field === 'budget_id') updates.budget_id = value === '_none' ? null : value;
      else if (field === 'linked_account_id') {
        const accountId = value === '_none' ? null : value;
        updates.linked_account_id = accountId;
        if (accountId) {
          const account = linkedAccounts.find(la => la.id === accountId);
          if (account) updates.payer = account.owner_partner;
        }
      }
      else updates[field] = value;
      await onUpdate(id, updates);
    } catch (e: any) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleEstimate = async (id: string, checked: boolean) => {
    try {
      await onUpdate(id, { is_estimate: checked });
    } catch (e: any) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string) => {
    try { await onRemove(id); } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  let totalFairX = 0, totalFairY = 0, totalMonthly = 0;
  const unsortedRows: ComputedRow[] = expenses.map(exp => {
    const { fairX, fairY, monthly } = computeFairShare(exp);
    totalFairX += fairX;
    totalFairY += fairY;
    totalMonthly += monthly;
    return { exp, fairX, fairY, monthly };
  });

  const resolveName = (id: string | null, list: { id: string; name: string }[]) =>
    id ? (list.find(x => x.id === id)?.name ?? '') : '';

  const sortRows = (arr: ComputedRow[]): ComputedRow[] => {
    const m = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name': cmp = a.exp.name.localeCompare(b.exp.name); break;
        case 'category': cmp = resolveName(a.exp.category_id, categories).localeCompare(resolveName(b.exp.category_id, categories)); break;
        case 'amount': cmp = a.exp.amount - b.exp.amount; break;
        case 'estimate': cmp = Number(a.exp.is_estimate) - Number(b.exp.is_estimate); break;
        case 'frequency': cmp = a.exp.frequency_type.localeCompare(b.exp.frequency_type); break;
        case 'param': cmp = (a.exp.frequency_param ?? 0) - (b.exp.frequency_param ?? 0); break;
        case 'monthly': cmp = a.monthly - b.monthly; break;
        case 'budget': cmp = resolveName(a.exp.budget_id, budgets).localeCompare(resolveName(b.exp.budget_id, budgets)); break;
        case 'payment_method': cmp = resolveName(a.exp.linked_account_id, linkedAccounts).localeCompare(resolveName(b.exp.linked_account_id, linkedAccounts)); break;
        case 'payer': cmp = a.exp.payer.localeCompare(b.exp.payer); break;
        case 'benefit_x': cmp = a.exp.benefit_x - b.exp.benefit_x; break;
        case 'benefit_y': cmp = (100 - a.exp.benefit_x) - (100 - b.exp.benefit_x); break;
        case 'fair_x': cmp = a.fairX - b.fairX; break;
        case 'fair_y': cmp = a.fairY - b.fairY; break;
      }
      return cmp * m;
    });
  };

  const rows = useMemo(() => sortRows(unsortedRows), [unsortedRows, sortCol, sortDir]);

  const getGroupKey = (row: ComputedRow): string => {
    switch (groupBy) {
      case 'category':
        return row.exp.category_id ?? '_ungrouped';
      case 'budget':
        return row.exp.budget_id ?? '_ungrouped';
      case 'payer':
        return row.exp.payer;
      case 'payment_method':
        return row.exp.linked_account_id ?? '_ungrouped';
      default:
        return '_all';
    }
  };

  const getGroupLabel = (key: string): string => {
    if (key === '_ungrouped') return 'Uncategorized';
    switch (groupBy) {
      case 'category':
        return categories.find(c => c.id === key)?.name ?? 'Uncategorized';
      case 'budget':
        return budgets.find(b => b.id === key)?.name ?? 'Uncategorized';
      case 'payer':
        return key === 'X' ? partnerX : partnerY;
      case 'payment_method':
        return linkedAccounts.find(la => la.id === key)?.name ?? 'Uncategorized';
      default:
        return '';
    }
  };

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, ComputedRow[]>();
    for (const row of rows) {
      const key = getGroupKey(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === '_ungrouped') return 1;
      if (b[0] === '_ungrouped') return -1;
      return getGroupLabel(a[0]).localeCompare(getGroupLabel(b[0]));
    });
  }, [groupBy, rows, categories, budgets, linkedAccounts, partnerX, partnerY]);

  const { tableRef, onCellKeyDown, onCellMouseDown } = useSpreadsheetNav();
  const sharedRowProps = { categories, budgets, linkedAccounts, partnerX, partnerY, partnerXColor, partnerYColor, handleUpdate, handleToggleEstimate, handleRemove, onCellKeyDown, onCellMouseDown };

  return (
    <Card className="max-w-none w-[100vw] relative left-1/2 -translate-x-1/2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Click any cell to edit. Changes save automatically.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupByOption)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Group by…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="category">Group by Category</SelectItem>
                <SelectItem value="budget">Group by Budget</SelectItem>
                <SelectItem value="payer">Group by Payer</SelectItem>
                <SelectItem value="payment_method">Group by Payment Method</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={adding} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-auto max-h-[calc(100vh-14rem)]" ref={tableRef}>
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow>
                <SortableHead column="name" label="Name" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[200px] sticky left-0 z-40 bg-card" />
                <SortableHead column="category" label="Category" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[190px]" />
                <SortableHead column="amount" label="Amount" current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="estimate" label="Est." current={sortCol} dir={sortDir} onSort={toggleSort} className="text-center" />
                <SortableHead column="frequency" label="Frequency" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[150px]" />
                <SortableHead column="param" label="Param" current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="monthly" label="Monthly" current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="budget" label="Budget" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[190px]" />
                <SortableHead column="payment_method" label="Payment Method" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[190px]" />
                <SortableHead column="payer" label="Payer" current={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortableHead column="benefit_x" label={`${partnerX} %`} current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="benefit_y" label={`${partnerY} %`} current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="fair_x" label={`Fair ${partnerX}`} current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="fair_y" label={`Fair ${partnerY}`} current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                    No expenses yet. Click "Add row" to start.
                  </TableCell>
                </TableRow>
              ) : grouped ? (
                (() => {
                  let visualIdx = 0;
                  return grouped.map(([key, groupRows]) => (
                    <React.Fragment key={`group-${key}`}>
                      <GroupSubtotalRow label={getGroupLabel(key)} rows={groupRows} />
                      {groupRows.map(row => {
                        const ri = visualIdx++;
                        return <ExpenseRow key={row.exp.id} {...row} {...sharedRowProps} rowIndex={ri} />;
                      })}
                    </React.Fragment>
                  ));
                })()
              ) : (
                rows.map((row, i) => (
                  <ExpenseRow key={row.exp.id} {...row} {...sharedRowProps} rowIndex={i} />
                ))
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold sticky left-0 z-10 bg-muted/50">Totals</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">${Math.round(totalMonthly)}</TableCell>
                  <TableCell colSpan={5} />
                  <TableCell className="text-right font-bold tabular-nums">${Math.round(totalFairX)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">${Math.round(totalFairY)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
