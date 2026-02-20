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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { DataGridAddFormAffixInput } from '@/components/ui/data-grid-add-form-affix-input';
import { Plus, Trash2, MoreHorizontal } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toMonthly, frequencyLabels, needsParam } from '@/lib/frequency';
import { DataGrid, GridEditableCell, GridCurrencyCell, useDataGrid, GRID_HEADER_TONE_CLASS, GRID_READONLY_TEXT_CLASS } from '@/components/ui/data-grid';
import type { FrequencyType } from '@/types/fairshare';
import type { Income } from '@/hooks/useIncomes';

const FREQ_OPTIONS: FrequencyType[] = ['weekly', 'twice_monthly', 'monthly', 'annual', 'every_n_days', 'every_n_weeks', 'every_n_months', 'k_times_weekly', 'k_times_monthly', 'k_times_annually'];
type NewIncomeDraft = Omit<Income, 'id' | 'household_id'>;

const createDefaultIncomeDraft = (): NewIncomeDraft => ({
  name: '',
  amount: 0,
  partner_label: 'X',
  frequency_type: 'monthly',
  frequency_param: null,
});

interface IncomesTabProps {
  incomes: Income[];
  partnerX: string;
  partnerY: string;
  onAdd: (income: Omit<Income, 'id' | 'household_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Income, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  fullView?: boolean;
}

const columnHelper = createColumnHelper<Income>();

// ─── Cell Components ───

function PartnerCell({ value, partnerX, partnerY, onChange }: { value: string; partnerX: string; partnerY: string; onChange: (v: string) => void }) {
  const ctx = useDataGrid();
  return (
    <Select value={value} onValueChange={v => {
      ctx?.onCellCommit(1);
      onChange(v);
    }}>
      <SelectTrigger
        className="h-7 border-transparent bg-transparent hover:border-border text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2"
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
        <SelectItem value="X">{partnerX}</SelectItem>
        <SelectItem value="Y">{partnerY}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FrequencyCell({ income, onChange }: { income: Income; onChange: (field: string, v: string) => void }) {
  const ctx = useDataGrid();
  return (
    <div className="flex items-center gap-1">
      <Select value={income.frequency_type} onValueChange={v => {
        ctx?.onCellCommit(3);
        onChange('frequency_type', v);
      }}>
        <SelectTrigger
          className="h-7 min-w-0 border-transparent bg-transparent hover:border-border text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2"
          data-row={ctx?.rowIndex}
          data-row-id={ctx?.rowId}
          data-col={3}
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
      {needsParam(income.frequency_type) && (
        <GridEditableCell value={income.frequency_param ?? ''} onChange={v => onChange('frequency_param', v)} type="number" navCol={4} placeholder="X" className="text-left w-8 shrink-0" />
      )}
    </div>
  );
}

function IncomeActionsCell({ income, onRemove }: { income: Income; onRemove: (id: string) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 cursor-pointer hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
            aria-label={`Actions for ${income.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
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

// ─── Main Component ───

export function IncomesTab({ incomes, partnerX, partnerY, onAdd, onUpdate, onRemove, fullView = false }: IncomesTabProps) {
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [newIncome, setNewIncome] = useState<NewIncomeDraft>(createDefaultIncomeDraft);

  const [sorting, setSorting] = useState<SortingState>(() => {
    try { const s = localStorage.getItem('incomes_sorting'); return s ? JSON.parse(s) : [{ id: 'name', desc: false }]; }
    catch { return [{ id: 'name', desc: false }]; }
  });
  useEffect(() => { localStorage.setItem('incomes_sorting', JSON.stringify(sorting)); }, [sorting]);

  const openAddIncomeModal = () => {
    setNewIncome(createDefaultIncomeDraft());
    setAddIncomeOpen(true);
  };

  const handleSaveIncome = async () => {
    if (savingIncome) return;
    setSavingIncome(true);
    try {
      const payload: NewIncomeDraft = {
        ...newIncome,
        frequency_param: needsParam(newIncome.frequency_type) ? newIncome.frequency_param : null,
      };
      await onAdd(payload);
      setAddIncomeOpen(false);
      setNewIncome(createDefaultIncomeDraft());
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingIncome(false);
  };

  const handleUpdate = (id: string, field: string, value: string) => {
    const updates: Record<string, unknown> = {};
    if (field === 'name') updates.name = value;
    else if (field === 'amount') updates.amount = Number(value) || 0;
    else if (field === 'frequency_param') updates.frequency_param = value ? Number(value) : null;
    else updates[field] = value;
    onUpdate(id, updates as any).catch((e: any) => {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    });
  };

  const handleRemove = async (id: string) => {
    try { await onRemove(id); } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      meta: { headerClassName: 'min-w-[200px]' },
      cell: ({ row }) => <GridEditableCell value={row.original.name} onChange={v => handleUpdate(row.original.id, 'name', v)} navCol={0} />,
    }),
    columnHelper.accessor('partner_label', {
      header: 'Partner',
      meta: { headerClassName: 'min-w-[190px]' },
      cell: ({ row }) => <PartnerCell value={row.original.partner_label} partnerX={partnerX} partnerY={partnerY} onChange={v => handleUpdate(row.original.id, 'partner_label', v)} />,
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      meta: { headerClassName: 'text-right' },
      cell: ({ row }) => <GridCurrencyCell value={Number(row.original.amount)} onChange={v => handleUpdate(row.original.id, 'amount', v)} navCol={2} />,
    }),
    columnHelper.accessor('frequency_type', {
      header: 'Frequency',
      meta: { headerClassName: 'min-w-[185px]' },
      cell: ({ row }) => <FrequencyCell income={row.original} onChange={(field, v) => handleUpdate(row.original.id, field, v)} />,
    }),
    columnHelper.accessor(
      row => toMonthly(row.amount, row.frequency_type, row.frequency_param ?? undefined),
      {
        id: 'monthly',
        header: 'Monthly',
        meta: { headerClassName: 'text-right', cellClassName: `text-right tabular-nums text-xs ${GRID_READONLY_TEXT_CLASS}` },
        cell: ({ getValue }) => `$${Math.round(getValue())}`,
      },
    ),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { headerClassName: 'w-12' },
      cell: ({ row }) => <IncomeActionsCell income={row.original} onRemove={handleRemove} />,
    }),
  ], [partnerX, partnerY]);

  const table = useReactTable({
    data: incomes,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const xTotal = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const yTotal = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const total = xTotal + yTotal;
  const ratioX = total > 0 ? (xTotal / total * 100) : 50;

  return (
    <Card className={`max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 ${fullView ? 'h-full min-h-0 flex flex-col' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Income Streams</CardTitle>
          <Button onClick={openAddIncomeModal} disabled={savingIncome} variant="outline" size="sm" className="h-8 gap-1.5">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`px-0 pb-0 ${fullView ? 'flex-1 min-h-0' : ''}`}>
        <DataGrid
          table={table}
          fullView={fullView}
          maxHeight={fullView ? 'none' : undefined}
          className={fullView ? 'h-full min-h-0' : undefined}
          emptyMessage='No income streams yet. Click "Add" to start.'
          footer={incomes.length > 0 ? (
            <>
              <tr className={`${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS}`}>
                <td className={`font-semibold text-xs ${GRID_HEADER_TONE_CLASS} px-2 py-1 ${fullView ? 'sticky left-0 z-10' : ''}`}>Totals</td>
                <td colSpan={3} className={`text-xs ${GRID_HEADER_TONE_CLASS} px-2 py-1`}>{partnerX}: ${Math.round(xTotal)} · {partnerY}: ${Math.round(yTotal)}</td>
                <td className={`text-right font-semibold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2 py-1`}>${Math.round(total)}</td>
                <td className={GRID_HEADER_TONE_CLASS} />
              </tr>
              <tr className={`${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS}`}>
                <td className={`text-xs ${GRID_HEADER_TONE_CLASS} px-2 py-1 ${fullView ? 'sticky left-0 z-10' : ''}`}>Income ratio: {partnerX} {ratioX.toFixed(0)}% / {partnerY} {(100 - ratioX).toFixed(0)}%</td>
                <td colSpan={5} className={GRID_HEADER_TONE_CLASS} />
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
          <DialogHeader><DialogTitle>Add Income Stream</DialogTitle></DialogHeader>
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
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">{partnerX}</SelectItem>
                  <SelectItem value="Y">{partnerY}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQ_OPTIONS.map(f => <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {needsParam(newIncome.frequency_type) && (
                  <Input
                    type="number"
                    value={newIncome.frequency_param == null ? '' : String(newIncome.frequency_param)}
                    onChange={e => setNewIncome(prev => ({ ...prev, frequency_param: e.target.value ? Number(e.target.value) : null }))}
                    disabled={savingIncome}
                    className="h-9 w-24"
                    placeholder="X"
                  />
                )}
              </div>
            </div>
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
            <Button onClick={handleSaveIncome} disabled={savingIncome}>{savingIncome ? 'Saving...' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
