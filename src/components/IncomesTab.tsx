import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2 } from 'lucide-react';
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

function EditableCell({ value, onChange, type = 'text', className = '', autoFocus = false }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (local !== String(value)) onChange(local);
  };

  return (
    <Input
      ref={ref}
      type={type}
      value={local}
      autoFocus={autoFocus}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && ref.current?.blur()}
      className={`h-8 border-transparent bg-transparent px-1 hover:border-border focus:border-primary ${className}`}
    />
  );
}

export function IncomesTab({ incomes, partnerX, partnerY, onAdd, onUpdate, onRemove }: IncomesTabProps) {
  const [adding, setAdding] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const prevCountRef = useRef(incomes.length);

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

  const xTotal = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const yTotal = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const total = xTotal + yTotal;
  const ratioX = total > 0 ? (xTotal / total * 100) : 50;

  return (
    <Card>
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
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground">Param</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-48 text-sm">Required for "Every N weeks" (N = interval) and "K times/year" (K = occurrences). Not used for other frequencies.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No income streams yet. Click "Add row" to start.
                  </TableCell>
                </TableRow>
              ) : incomes.map(inc => (
                <TableRow key={inc.id}>
                  <TableCell>
                    <Select value={inc.partner_label} onValueChange={v => handleUpdate(inc.id, 'partner_label', v)}>
                      <SelectTrigger className="h-8 w-24 border-transparent bg-transparent hover:border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="X">{partnerX}</SelectItem>
                        <SelectItem value="Y">{partnerY}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={inc.name}
                      onChange={v => handleUpdate(inc.id, 'name', v)}
                      autoFocus={focusId === inc.id}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={Number(inc.amount)} onChange={v => handleUpdate(inc.id, 'amount', v)} type="number" className="text-right" />
                  </TableCell>
                  <TableCell>
                    <Select value={inc.frequency_type} onValueChange={v => handleUpdate(inc.id, 'frequency_type', v)}>
                      <SelectTrigger className="h-8 border-transparent bg-transparent hover:border-border">
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
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs px-1">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
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
                  <TableCell colSpan={5} className="font-semibold">
                    {partnerX}: ${Math.round(xTotal)} · {partnerY}: ${Math.round(yTotal)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">${Math.round(total)}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} className="text-xs text-muted-foreground">
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
