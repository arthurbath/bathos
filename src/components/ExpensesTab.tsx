import { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2 } from 'lucide-react';
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
  onAdd: (expense: Omit<Expense, 'id' | 'household_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const FREQ_OPTIONS: FrequencyType[] = ['monthly', 'twice_monthly', 'weekly', 'every_n_weeks', 'annual', 'k_times_annually'];
const NEEDS_PARAM: Set<FrequencyType> = new Set(['every_n_weeks', 'k_times_annually']);

function EditableCell({ value, onChange, type = 'text', className = '', min, max, step }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
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
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && ref.current?.blur()}
      className={`h-7 border-transparent bg-transparent px-1 hover:border-border focus:border-primary !text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}

export function ExpensesTab({ expenses, categories, budgets, linkedAccounts, incomes, partnerX, partnerY, onAdd, onUpdate, onRemove }: ExpensesTabProps) {
  const [adding, setAdding] = useState(false);

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
        name: 'New expense',
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
      else if (field === 'linked_account_id') updates.linked_account_id = value === '_none' ? null : value;
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
  const rows = expenses.map(exp => {
    const { fairX, fairY, monthly } = computeFairShare(exp);
    totalFairX += fairX;
    totalFairY += fairY;
    totalMonthly += monthly;
    return { exp, fairX, fairY, monthly };
  });

  return (
    <Card className="max-w-none w-[100vw] relative left-1/2 -translate-x-1/2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Click any cell to edit. Changes save automatically.</CardDescription>
          </div>
          <Button onClick={handleAdd} disabled={adding} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 z-20 bg-background">Name</TableHead>
                <TableHead className="min-w-[190px]">Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Est.</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Param</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="min-w-[140px]">Budget</TableHead>
                <TableHead className="min-w-[140px]">Linked</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead className="text-right">{partnerX} %</TableHead>
                <TableHead className="text-right">{partnerY} %</TableHead>
                <TableHead className="text-right">Fair {partnerX}</TableHead>
                <TableHead className="text-right">Fair {partnerY}</TableHead>
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
              ) : rows.map(({ exp, fairX, fairY, monthly }) => (
                <TableRow key={exp.id}>
                  <TableCell className="sticky left-0 z-10 bg-background">
                    <EditableCell value={exp.name} onChange={v => handleUpdate(exp.id, 'name', v)} />
                  </TableCell>
                  <TableCell>
                    <Select value={exp.category_id ?? '_none'} onValueChange={v => handleUpdate(exp.id, 'category_id', v)}>
                      <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs">
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
                    <EditableCell value={Number(exp.amount)} onChange={v => handleUpdate(exp.id, 'amount', v)} type="number" className="text-right" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={exp.is_estimate} onCheckedChange={(checked) => handleToggleEstimate(exp.id, !!checked)} />
                  </TableCell>
                  <TableCell>
                    <Select value={exp.frequency_type} onValueChange={v => handleUpdate(exp.id, 'frequency_type', v)}>
                      <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs">
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
                      <EditableCell value={exp.frequency_param ?? ''} onChange={v => handleUpdate(exp.id, 'frequency_param', v)} type="number" className="text-right w-16" />
                    ) : (
                      <span className="text-muted-foreground text-xs px-1">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-xs">${Math.round(monthly)}</TableCell>
                  <TableCell>
                    <Select value={exp.budget_id ?? '_none'} onValueChange={v => handleUpdate(exp.id, 'budget_id', v)}>
                      <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs">
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
                      <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {linkedAccounts.map(la => (
                          <SelectItem key={la.id} value={la.id}>{la.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={exp.payer} onValueChange={v => handleUpdate(exp.id, 'payer', v)}>
                      <SelectTrigger className="h-7 w-24 border-transparent bg-transparent hover:border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="X">{partnerX}</SelectItem>
                        <SelectItem value="Y">{partnerY}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <EditableCell value={exp.benefit_x} onChange={v => handleUpdate(exp.id, 'benefit_x', v)} type="number" className="text-right w-16" min={0} max={100} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums text-xs">
                    {100 - exp.benefit_x}
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
              ))}
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
