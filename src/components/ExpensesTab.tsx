import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { FrequencySelector } from '@/components/FrequencySelector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toMonthly, frequencyLabels } from '@/lib/frequency';
import type { FrequencyType } from '@/types/fairshare';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';

interface ExpensesTabProps {
  expenses: Expense[];
  categories: Category[];
  partnerX: string;
  partnerY: string;
  onAdd: (expense: Omit<Expense, 'id' | 'household_id'>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function ExpensesTab({ expenses, categories, partnerX, partnerY, onAdd, onRemove }: ExpensesTabProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<'X' | 'Y'>('X');
  const [benefitX, setBenefitX] = useState(50);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [freqType, setFreqType] = useState<FrequencyType>('monthly');
  const [freqParam, setFreqParam] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !amount) return;
    setAdding(true);
    try {
      await onAdd({
        name: name.trim(),
        amount: Number(amount),
        payer,
        benefit_x: benefitX,
        category_id: categoryId,
        frequency_type: freqType,
        frequency_param: freqParam,
      });
      setName('');
      setAmount('');
      setBenefitX(50);
      setCategoryId(null);
      setFreqType('monthly');
      setFreqParam(null);
    } catch (e: any) {
      toast({ title: 'Error adding expense', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await onRemove(id);
    } catch (e: any) {
      toast({ title: 'Error removing expense', description: e.message, variant: 'destructive' });
    }
  };

  const totalMonthly = expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency_type, e.frequency_param ?? undefined), 0);
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
          <CardDescription>Add a shared or individual expense.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. Rent" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Paid by</Label>
              <Select value={payer} onValueChange={v => setPayer(v as 'X' | 'Y')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">{partnerX}</SelectItem>
                  <SelectItem value="Y">{partnerY}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={categoryId ?? '_none'} onValueChange={v => setCategoryId(v === '_none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FrequencySelector type={freqType} param={freqParam} onTypeChange={setFreqType} onParamChange={setFreqParam} />
          </div>
          <div className="space-y-2">
            <Label>Benefit split: {partnerX} {benefitX}% / {partnerY} {100 - benefitX}%</Label>
            <Slider value={[benefitX]} onValueChange={v => setBenefitX(v[0])} min={0} max={100} step={5} />
          </div>
          <Button onClick={handleAdd} disabled={!name.trim() || !amount || adding} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add expense
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>Total: ${totalMonthly.toFixed(2)}/mo</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Freq</TableHead>
                    <TableHead>Benefit</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-medium">{exp.name}</TableCell>
                      <TableCell>{exp.payer === 'X' ? partnerX : partnerY}</TableCell>
                      <TableCell className="text-muted-foreground">{exp.category_id ? catMap[exp.category_id] ?? '—' : '—'}</TableCell>
                      <TableCell className="text-right">${Number(exp.amount).toFixed(2)}</TableCell>
                      <TableCell>{frequencyLabels[exp.frequency_type]}</TableCell>
                      <TableCell className="text-xs">
                        {exp.benefit_x}/{100 - exp.benefit_x}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(exp.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
