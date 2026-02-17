import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toMonthly, frequencyLabels, needsParam } from '@/lib/frequency';
import { DataGrid, GridEditableCell, GridCurrencyCell, GridPercentCell, useDataGrid, gridNavProps } from '@/components/ui/data-grid';
import type { FrequencyType } from '@/types/fairshare';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Income } from '@/hooks/useIncomes';

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
  partnerXColor: string | null;
  partnerYColor: string | null;
  onAdd: (expense: Omit<Expense, 'id' | 'household_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onAddLinkedAccount: (name: string, ownerPartner?: string) => Promise<void>;
}

const FREQ_OPTIONS: FrequencyType[] = ['weekly', 'twice_monthly', 'monthly', 'annual', 'every_n_days', 'every_n_weeks', 'every_n_months', 'k_times_weekly', 'k_times_monthly', 'k_times_annually'];
type GroupByOption = 'none' | 'category' | 'estimated' | 'payer' | 'payment_method';

const columnHelper = createColumnHelper<ComputedRow>();

// ─── Cell Components ───

function CategoryCell({ exp, categories, onChange, onAddNew }: {
  exp: Expense; categories: Category[]; onChange: (v: string) => void; onAddNew: () => void;
}) {
  const ctx = useDataGrid();
  return (
    <Select value={exp.category_id ?? '_none'} onValueChange={v => { if (v === '_add_new') onAddNew(); else onChange(v); }}>
      <SelectTrigger
        className="h-7 border-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm"
        style={{ backgroundColor: categories.find(c => c.id === exp.category_id)?.color || 'transparent' }}
        {...gridNavProps(ctx, 1)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">—</SelectItem>
        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        <SelectItem value="_add_new" className="text-primary font-medium"><Plus className="inline h-3 w-3 mr-1" />Add New</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ExpenseFrequencyCell({ exp, onChange }: { exp: Expense; onChange: (field: string, v: string) => void }) {
  const ctx = useDataGrid();
  return (
    <div className="flex items-center gap-1">
      <Select value={exp.frequency_type} onValueChange={v => onChange('frequency_type', v)}>
        <SelectTrigger className="h-7 min-w-0 border-transparent bg-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2" {...gridNavProps(ctx, 4)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREQ_OPTIONS.map(f => <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>)}
        </SelectContent>
      </Select>
      {needsParam(exp.frequency_type) && (
        <GridEditableCell value={exp.frequency_param ?? ''} onChange={v => onChange('frequency_param', v)} type="number" navCol={5} placeholder="N" className="text-left w-8 shrink-0" />
      )}
    </div>
  );
}

function PaymentMethodCell({ exp, linkedAccounts, partnerX, partnerY, onChange, onAddNew }: {
  exp: Expense; linkedAccounts: LinkedAccount[]; partnerX: string; partnerY: string; onChange: (v: string) => void; onAddNew: () => void;
}) {
  const ctx = useDataGrid();
  return (
    <Select value={exp.linked_account_id ?? '_none'} onValueChange={v => { if (v === '_add_new') onAddNew(); else onChange(v); }}>
      <SelectTrigger
        className="h-7 border-transparent hover:border-border text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 rounded-sm"
        style={{ backgroundColor: linkedAccounts.find(la => la.id === exp.linked_account_id)?.color || 'transparent' }}
        {...gridNavProps(ctx, 6)}
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
        <SelectItem value="_add_new" className="text-primary font-medium"><Plus className="inline h-3 w-3 mr-1" />Add New</SelectItem>
      </SelectContent>
    </Select>
  );
}

function EstimateCell({ checked, onToggle }: { checked: boolean; onToggle: (v: boolean) => void }) {
  const ctx = useDataGrid();
  return <Checkbox checked={checked} onCheckedChange={v => onToggle(!!v)} {...gridNavProps(ctx, 3)} />;
}

function ExpenseDeleteCell({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost-destructive" size="icon" className="h-7 w-7">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete expense</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete &ldquo;{name}&rdquo;? This action cannot be undone.</AlertDialogDescription>
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

export function ExpensesTab({ expenses, categories, linkedAccounts, incomes, partnerX, partnerY, partnerXColor, partnerYColor, onAdd, onUpdate, onRemove, onAddCategory, onAddLinkedAccount }: ExpensesTabProps) {
  const [adding, setAdding] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(expenses.length);
  const [addDialog, setAddDialog] = useState<'category' | 'payment_method' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemOwner, setNewItemOwner] = useState<'X' | 'Y'>('X');
  const [savingItem, setSavingItem] = useState(false);

  const [filterPayer, setFilterPayer] = useState<'all' | 'X' | 'Y'>(() => (localStorage.getItem('expenses_filterPayer') as 'all' | 'X' | 'Y') || 'all');
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => (localStorage.getItem('expenses_groupBy') as GroupByOption) || 'none');
  const [sorting, setSorting] = useState<SortingState>(() => {
    try { const s = localStorage.getItem('expenses_sorting'); return s ? JSON.parse(s) : [{ id: 'name', desc: false }]; }
    catch { return [{ id: 'name', desc: false }]; }
  });

  useEffect(() => { localStorage.setItem('expenses_filterPayer', filterPayer); }, [filterPayer]);
  useEffect(() => { localStorage.setItem('expenses_groupBy', groupBy); }, [groupBy]);
  useEffect(() => { localStorage.setItem('expenses_sorting', JSON.stringify(sorting)); }, [sorting]);

  useEffect(() => {
    if (expenses.length > prevCountRef.current) {
      requestAnimationFrame(() => {
        const cells = wrapperRef.current?.querySelectorAll<HTMLElement>('[data-col="0"]');
        if (cells?.length) cells[cells.length - 1].focus();
      });
    }
    prevCountRef.current = expenses.length;
  }, [expenses.length]);

  // Income ratio
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

  const filteredExpenses = filterPayer === 'all' ? expenses : expenses.filter(e => e.payer === filterPayer);
  const computedData: ComputedRow[] = useMemo(() =>
    filteredExpenses.map(exp => ({ exp, ...computeFairShare(exp) })),
    [filteredExpenses, incomeRatioX],
  );

  let totalFairX = 0, totalFairY = 0, totalMonthly = 0;
  computedData.forEach(r => { totalFairX += r.fairX; totalFairY += r.fairY; totalMonthly += r.monthly; });

  // ─── Handlers ───

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAdd({ name: '', amount: 0, payer: null, benefit_x: 50, category_id: null, budget_id: null, linked_account_id: null, frequency_type: 'monthly', frequency_param: null, is_estimate: false });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleUpdate = (id: string, field: string, value: string) => {
    const updates: Record<string, unknown> = {};
    if (field === 'name') updates.name = value;
    else if (field === 'amount') updates.amount = Number(value) || 0;
    else if (field === 'benefit_x') updates.benefit_x = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    else if (field === 'frequency_param') updates.frequency_param = value ? Number(value) : null;
    else if (field === 'category_id') updates.category_id = value === '_none' ? null : value;
    else if (field === 'linked_account_id') {
      const accountId = value === '_none' ? null : value;
      updates.linked_account_id = accountId;
      if (accountId) {
        const account = linkedAccounts.find(la => la.id === accountId);
        if (account) updates.payer = account.owner_partner;
      } else { updates.payer = null; }
    } else updates[field] = value;
    onUpdate(id, updates as any).catch((e: any) => {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    });
  };

  const handleToggleEstimate = (id: string, checked: boolean) => {
    onUpdate(id, { is_estimate: checked }).catch((e: any) => {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    });
  };

  const handleRemove = async (id: string) => {
    try { await onRemove(id); } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSaveNewItem = async () => {
    if (!newItemName.trim()) return;
    setSavingItem(true);
    try {
      if (addDialog === 'category') await onAddCategory(newItemName.trim());
      else if (addDialog === 'payment_method') await onAddLinkedAccount(newItemName.trim(), newItemOwner);
      setAddDialog(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingItem(false);
  };

  // ─── Columns ───

  const columns = useMemo(() => [
    columnHelper.accessor(r => r.exp.name, {
      id: 'name',
      header: 'Name',
      meta: { headerClassName: 'min-w-[120px] sm:min-w-[200px]' },
      cell: ({ row }) => <GridEditableCell value={row.original.exp.name} onChange={v => handleUpdate(row.original.exp.id, 'name', v)} navCol={0} placeholder="Expense" />,
    }),
    columnHelper.accessor(r => r.exp.category_id, {
      id: 'category',
      header: 'Category',
      meta: { headerClassName: 'min-w-[190px]' },
      sortingFn: (a, b) => (categories.find(c => c.id === a.original.exp.category_id)?.name ?? '').localeCompare(categories.find(c => c.id === b.original.exp.category_id)?.name ?? ''),
      cell: ({ row }) => (
        <CategoryCell exp={row.original.exp} categories={categories} onChange={v => handleUpdate(row.original.exp.id, 'category_id', v)} onAddNew={() => { setNewItemName(''); setNewItemOwner('X'); setAddDialog('category'); }} />
      ),
    }),
    columnHelper.accessor(r => r.exp.amount, {
      id: 'amount',
      header: 'Amount',
      meta: { headerClassName: 'text-right' },
      cell: ({ row }) => <GridCurrencyCell value={Number(row.original.exp.amount)} onChange={v => handleUpdate(row.original.exp.id, 'amount', v)} navCol={2} />,
    }),
    columnHelper.accessor(r => r.exp.is_estimate, {
      id: 'estimate',
      header: () => (
        <Tooltip><TooltipTrigger asChild><span className="underline decoration-dotted underline-offset-2">Est</span></TooltipTrigger><TooltipContent side="bottom">Expense is estimated</TooltipContent></Tooltip>
      ),
      meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
      cell: ({ row }) => <EstimateCell checked={row.original.exp.is_estimate} onToggle={v => handleToggleEstimate(row.original.exp.id, v)} />,
    }),
    columnHelper.accessor(r => r.exp.frequency_type, {
      id: 'frequency',
      header: 'Frequency',
      meta: { headerClassName: 'min-w-[185px]' },
      cell: ({ row }) => <ExpenseFrequencyCell exp={row.original.exp} onChange={(field, v) => handleUpdate(row.original.exp.id, field, v)} />,
    }),
    columnHelper.accessor('monthly', {
      id: 'monthly',
      header: () => (
        <Tooltip><TooltipTrigger asChild><span className="underline decoration-dotted underline-offset-2">Monthly</span></TooltipTrigger><TooltipContent side="bottom">Expense normalized to how much it costs you monthly</TooltipContent></Tooltip>
      ),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right font-medium tabular-nums text-xs' },
      cell: ({ getValue }) => `$${Math.round(getValue())}`,
    }),
    columnHelper.accessor(r => r.exp.linked_account_id, {
      id: 'payment_method',
      header: 'Payment Method',
      meta: { headerClassName: 'min-w-[190px]' },
      sortingFn: (a, b) => (linkedAccounts.find(la => la.id === a.original.exp.linked_account_id)?.name ?? '').localeCompare(linkedAccounts.find(la => la.id === b.original.exp.linked_account_id)?.name ?? ''),
      cell: ({ row }) => (
        <PaymentMethodCell exp={row.original.exp} linkedAccounts={linkedAccounts} partnerX={partnerX} partnerY={partnerY} onChange={v => handleUpdate(row.original.exp.id, 'linked_account_id', v)} onAddNew={() => { setNewItemName(''); setNewItemOwner('X'); setAddDialog('payment_method'); }} />
      ),
    }),
    columnHelper.accessor(r => r.exp.payer, {
      id: 'payer',
      header: 'Payer',
      sortingFn: (a, b) => (a.original.exp.payer ?? '').localeCompare(b.original.exp.payer ?? ''),
      cell: ({ row }) => {
        const p = row.original.exp.payer;
        return p ? (
          <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: (p === 'X' ? partnerXColor : partnerYColor) || 'transparent' }}>
            {p === 'X' ? partnerX : partnerY}
          </span>
        ) : <span className="text-muted-foreground text-xs px-1">—</span>;
      },
    }),
    columnHelper.accessor(r => r.exp.benefit_x, {
      id: 'benefit_x',
      header: () => (
        <Tooltip><TooltipTrigger asChild><span className="underline decoration-dotted underline-offset-2">{partnerX} %</span></TooltipTrigger><TooltipContent side="bottom">The percentage that {partnerX} benefits from the expense</TooltipContent></Tooltip>
      ),
      meta: { headerClassName: 'text-right whitespace-nowrap' },
      cell: ({ row }) => (
        <GridPercentCell value={row.original.exp.benefit_x} onChange={v => { const c = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); handleUpdate(row.original.exp.id, 'benefit_x', String(c)); }} navCol={7} className="w-16" />
      ),
    }),
    columnHelper.accessor(r => 100 - r.exp.benefit_x, {
      id: 'benefit_y',
      header: () => (
        <Tooltip><TooltipTrigger asChild><span className="underline decoration-dotted underline-offset-2">{partnerY} %</span></TooltipTrigger><TooltipContent side="bottom">The percentage that {partnerY} benefits from the expense</TooltipContent></Tooltip>
      ),
      meta: { headerClassName: 'text-right whitespace-nowrap', cellClassName: 'text-right tabular-nums text-xs' },
      cell: ({ row }) => (
        <GridPercentCell value={100 - row.original.exp.benefit_x} onChange={v => { const c = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); handleUpdate(row.original.exp.id, 'benefit_x', String(100 - c)); }} navCol={8} className="w-16" />
      ),
    }),
    columnHelper.accessor('fairX', {
      id: 'fair_x',
      header: `Fair ${partnerX}`,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
      cell: ({ getValue }) => `$${Math.round(getValue())}`,
    }),
    columnHelper.accessor('fairY', {
      id: 'fair_y',
      header: `Fair ${partnerY}`,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
      cell: ({ getValue }) => `$${Math.round(getValue())}`,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { headerClassName: 'w-10' },
      cell: ({ row }) => <ExpenseDeleteCell name={row.original.exp.name} onRemove={() => handleRemove(row.original.exp.id)} />,
    }),
  ], [categories, linkedAccounts, partnerX, partnerY, partnerXColor, partnerYColor]);

  const table = useReactTable({
    data: computedData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
        case 'payer': return row.exp.payer ?? '_ungrouped';
        case 'payment_method': return row.exp.linked_account_id ?? '_ungrouped';
        default: return '_all';
      }
    };
  }, [groupBy]);

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

  const renderGroupHeader = (key: string, groupRows: Row<ComputedRow>[]) => {
    const gMonthly = groupRows.reduce((s, r) => s + r.original.monthly, 0);
    const gFairX = groupRows.reduce((s, r) => s + r.original.fairX, 0);
    const gFairY = groupRows.reduce((s, r) => s + r.original.fairY, 0);
    return (
      <tr key={`gh-${key}`} className="bg-muted sticky top-[36px] z-20 border-b-0 shadow-[0_1px_0_0_hsl(var(--border))]">
        <td className="sticky left-0 z-10 bg-muted font-semibold text-xs px-2 py-1">{getGroupLabel(key)}</td>
        <td colSpan={4} className="bg-muted" />
        <td className="text-right font-semibold tabular-nums text-xs bg-muted px-2 py-1">${Math.round(gMonthly)}</td>
        <td colSpan={4} className="bg-muted" />
        <td className="text-right font-semibold tabular-nums text-xs bg-muted px-2 py-1">${Math.round(gFairX)}</td>
        <td className="text-right font-semibold tabular-nums text-xs bg-muted px-2 py-1">${Math.round(gFairY)}</td>
        <td className="bg-muted" />
      </tr>
    );
  };

  const dialogTitle = addDialog === 'category' ? 'New Category' : 'New Payment Method';

  return (
    <Card className="max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>Expenses</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterPayer} onValueChange={v => setFilterPayer(v as 'all' | 'X' | 'Y')}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All partners</SelectItem>
                <SelectItem value="X">{partnerX} only</SelectItem>
                <SelectItem value="Y">{partnerY} only</SelectItem>
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
            <Button onClick={handleAdd} disabled={adding} variant="outline" size="sm" className="h-8 gap-1.5">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div ref={wrapperRef}>
          <DataGrid
            table={table}
            emptyMessage='No expenses yet. Click "Add" to start.'
            groupBy={getGroupKey}
            renderGroupHeader={renderGroupHeader}
            footer={computedData.length > 0 ? (
              <tr className="bg-muted shadow-[0_-1px_0_0_hsl(var(--border))]">
                <td className="font-semibold text-xs sticky left-0 z-10 bg-muted px-2 py-1">Totals</td>
                <td colSpan={4} className="bg-muted" />
                <td className="text-right font-semibold tabular-nums text-xs bg-muted px-2 py-1">${Math.round(totalMonthly)}</td>
                <td colSpan={4} className="bg-muted" />
                <td className="text-right font-semibold tabular-nums text-xs bg-muted px-2 py-1">${Math.round(totalFairX)}</td>
                <td className="text-right font-semibold tabular-nums text-xs bg-muted px-2 py-1">${Math.round(totalFairY)}</td>
                <td className="bg-muted" />
              </tr>
            ) : undefined}
          />
        </div>
      </CardContent>

      <Dialog open={addDialog !== null} onOpenChange={open => { if (!open) setAddDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-item-name">Name</Label>
              <Input id="new-item-name" value={newItemName} onChange={e => setNewItemName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveNewItem(); }} />
            </div>
            {addDialog === 'payment_method' && (
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Select value={newItemOwner} onValueChange={v => setNewItemOwner(v as 'X' | 'Y')}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X">{partnerX}</SelectItem>
                    <SelectItem value="Y">{partnerY}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveNewItem} disabled={savingItem || !newItemName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
