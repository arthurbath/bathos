import { useState, useRef, useEffect, useMemo } from 'react';
import { useSpreadsheetNav } from '@/hooks/useSpreadsheetNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toMonthly, frequencyLabels } from '@/lib/frequency';
import type { FrequencyType } from '@/types/fairshare';
import type { Income } from '@/hooks/useIncomes';

interface IncomesTabProps {
  incomes: Income[];
  partnerX: string;
  partnerY: string;
  onAdd: (income: Omit<Income, 'id' | 'household_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Income, 'id' | 'household_id'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const FREQ_OPTIONS: FrequencyType[] = ['monthly', 'twice_monthly', 'weekly', 'every_n_weeks', 'annual', 'k_times_annually'];
const NEEDS_PARAM: Set<FrequencyType> = new Set(['every_n_weeks', 'k_times_annually']);

type SortColumn = 'partner' | 'name' | 'amount' | 'frequency' | 'param' | 'monthly';
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

function EditableCell({ value, onChange, type = 'text', className = '', autoFocus = false, 'data-row': dataRow, 'data-col': dataCol, onCellKeyDown, onCellMouseDown }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  autoFocus?: boolean;
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
      autoFocus={autoFocus}
      data-row={dataRow}
      data-col={dataCol}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (onCellKeyDown) onCellKeyDown(e);
        else if (e.key === 'Enter') ref.current?.blur();
      }}
      onMouseDown={onCellMouseDown}
      className={`h-7 border-transparent bg-transparent px-1 hover:border-border focus:border-primary !text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
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

  return focused ? (
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
      className={`h-7 border-transparent bg-transparent px-1 hover:border-border focus:border-primary !text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  ) : (
    <button
      type="button"
      data-row={dataRow}
      data-col={dataCol}
      onClick={() => setFocused(true)}
      onMouseDown={onCellMouseDown}
      className={`h-7 w-full bg-transparent px-1 !text-xs text-right cursor-text border border-transparent hover:border-border rounded-md ${className}`}
    >
      ${Math.round(Number(local) || 0)}
    </button>
  );
}

export function IncomesTab({ incomes, partnerX, partnerY, onAdd, onUpdate, onRemove }: IncomesTabProps) {
  const [adding, setAdding] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const prevCountRef = useRef(incomes.length);
  const [sortCol, setSortCol] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const { tableRef, onCellKeyDown, onCellMouseDown } = useSpreadsheetNav();

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  useEffect(() => {
    if (incomes.length > prevCountRef.current) {
      const newest = incomes[incomes.length - 1];
      if (newest) setFocusId(newest.id);
    }
    prevCountRef.current = incomes.length;
  }, [incomes]);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAdd({
        name: 'New income',
        amount: 0,
        partner_label: 'X',
        frequency_type: 'monthly',
        frequency_param: null,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleUpdate = (id: string, field: string, value: string) => {
    const updates: any = {};
    if (field === 'name') updates.name = value;
    else if (field === 'amount') updates.amount = Number(value) || 0;
    else if (field === 'frequency_param') updates.frequency_param = value ? Number(value) : null;
    else updates[field] = value;
    onUpdate(id, updates).catch((e: any) => {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    });
  };

  const handleRemove = async (id: string) => {
    try { await onRemove(id); } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const rows = useMemo(() => {
    const m = sortDir === 'asc' ? 1 : -1;
    return [...incomes].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'partner': cmp = a.partner_label.localeCompare(b.partner_label); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'frequency': cmp = a.frequency_type.localeCompare(b.frequency_type); break;
        case 'param': cmp = (a.frequency_param ?? 0) - (b.frequency_param ?? 0); break;
        case 'monthly':
          cmp = toMonthly(a.amount, a.frequency_type, a.frequency_param ?? undefined)
              - toMonthly(b.amount, b.frequency_type, b.frequency_param ?? undefined);
          break;
      }
      return cmp * m;
    });
  }, [incomes, sortCol, sortDir]);

  const xTotal = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const yTotal = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const total = xTotal + yTotal;
  const ratioX = total > 0 ? (xTotal / total * 100) : 50;

  return (
    <Card className="max-w-none w-[100vw] relative left-1/2 -translate-x-1/2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Income Streams</CardTitle>
            <CardDescription>Click any cell to edit. Changes save automatically.</CardDescription>
          </div>
          <Button onClick={handleAdd} disabled={adding} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-x-auto" ref={tableRef}>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <SortableHead column="name" label="Name" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[200px] sticky left-0 z-20 bg-background" />
                <SortableHead column="partner" label="Partner" current={sortCol} dir={sortDir} onSort={toggleSort} className="min-w-[190px]" />
                <SortableHead column="amount" label="Amount" current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="frequency" label="Frequency" current={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortableHead column="param" label="Param" current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortableHead column="monthly" label="Monthly" current={sortCol} dir={sortDir} onSort={toggleSort} className="text-right" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No income streams yet. Click "Add row" to start.
                  </TableCell>
                </TableRow>
              ) : rows.map((inc, rowIndex) => (
                <TableRow key={inc.id}>
                  <TableCell className="sticky left-0 z-10 bg-background">
                    <EditableCell
                      value={inc.name}
                      onChange={v => handleUpdate(inc.id, 'name', v)}
                      autoFocus={focusId === inc.id}
                      data-row={rowIndex}
                      data-col={0}
                      onCellKeyDown={onCellKeyDown}
                      onCellMouseDown={onCellMouseDown}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={inc.partner_label} onValueChange={v => handleUpdate(inc.id, 'partner_label', v)}>
                      <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs" data-row={rowIndex} data-col={1} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="X">{partnerX}</SelectItem>
                        <SelectItem value="Y">{partnerY}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <CurrencyCell value={Number(inc.amount)} onChange={v => handleUpdate(inc.id, 'amount', v)} className="text-right" data-row={rowIndex} data-col={2} onCellKeyDown={onCellKeyDown} onCellMouseDown={onCellMouseDown} />
                  </TableCell>
                  <TableCell>
                    <Select value={inc.frequency_type} onValueChange={v => handleUpdate(inc.id, 'frequency_type', v)}>
                      <SelectTrigger className="h-7 border-transparent bg-transparent hover:border-border text-xs" data-row={rowIndex} data-col={3} onKeyDown={onCellKeyDown} onMouseDown={onCellMouseDown}>
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
                    {NEEDS_PARAM.has(inc.frequency_type) ? (
                      <EditableCell
                        value={inc.frequency_param ?? ''}
                        onChange={v => handleUpdate(inc.id, 'frequency_param', v)}
                        type="number"
                        className="text-right w-16"
                        data-row={rowIndex}
                        data-col={4}
                        onCellKeyDown={onCellKeyDown}
                        onCellMouseDown={onCellMouseDown}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs px-1">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-xs">
                    ${Math.round(toMonthly(inc.amount, inc.frequency_type, inc.frequency_param ?? undefined))}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete income</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{inc.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemove(inc.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {incomes.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold sticky left-0 z-10 bg-muted/50">Totals</TableCell>
                  <TableCell colSpan={4} className="text-xs">
                    {partnerX}: ${Math.round(xTotal)} · {partnerY}: ${Math.round(yTotal)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">${Math.round(total)}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} className="text-xs text-muted-foreground sticky left-0 z-10 bg-muted/50">
                    Income ratio: {partnerX} {ratioX.toFixed(0)}% / {partnerY} {(100 - ratioX).toFixed(0)}%
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
