import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FrequencySelector } from '@/components/FrequencySelector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  onRemove: (id: string) => Promise<void>;
}

export function IncomesTab({ incomes, partnerX, partnerY, onAdd, onRemove }: IncomesTabProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [partner, setPartner] = useState<'X' | 'Y'>('X');
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
        partner_label: partner,
        frequency_type: freqType,
        frequency_param: freqParam,
      });
      setName('');
      setAmount('');
      setFreqType('monthly');
      setFreqParam(null);
    } catch (e: any) {
      toast({ title: 'Error adding income', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await onRemove(id);
    } catch (e: any) {
      toast({ title: 'Error removing income', description: e.message, variant: 'destructive' });
    }
  };

  const xTotal = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const yTotal = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Income Stream</CardTitle>
          <CardDescription>Add a recurring income for either partner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. Salary" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Partner</Label>
              <Select value={partner} onValueChange={v => setPartner(v as 'X' | 'Y')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">{partnerX}</SelectItem>
                  <SelectItem value="Y">{partnerY}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FrequencySelector type={freqType} param={freqParam} onTypeChange={setFreqType} onParamChange={setFreqParam} />
          </div>
          <Button onClick={handleAdd} disabled={!name.trim() || !amount || adding} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add income
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income Streams</CardTitle>
          <CardDescription>
            {partnerX}: ${xTotal.toFixed(2)}/mo · {partnerY}: ${yTotal.toFixed(2)}/mo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incomes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No income streams yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.map(inc => (
                  <TableRow key={inc.id}>
                    <TableCell className="font-medium">{inc.name}</TableCell>
                    <TableCell>{inc.partner_label === 'X' ? partnerX : partnerY}</TableCell>
                    <TableCell className="text-right">${Number(inc.amount).toFixed(2)}</TableCell>
                    <TableCell>{frequencyLabels[inc.frequency_type]}</TableCell>
                    <TableCell className="text-right">
                      ${toMonthly(inc.amount, inc.frequency_type, inc.frequency_param ?? undefined).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(inc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
