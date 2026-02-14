import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Trash2, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { RestorePoint } from '@/hooks/useRestorePoints';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';
import type { Json } from '@/integrations/supabase/types';

interface RestoreTabProps {
  points: RestorePoint[];
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  onSave: (name: string, snapshot: Json) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRestore: (data: Json) => Promise<void>;
}

export function RestoreTab({ points, incomes, expenses, categories, onSave, onRemove, onRestore }: RestoreTabProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const snapshot: Json = {
        incomes: incomes.map(({ id, name, amount, frequency_type, frequency_param, partner_label }) =>
          ({ id, name, amount, frequency_type, frequency_param, partner_label })
        ) as unknown as Json,
        expenses: expenses.map(({ id, name, amount, frequency_type, frequency_param, payer, benefit_x, category_id }) =>
          ({ id, name, amount, frequency_type, frequency_param, payer, benefit_x, category_id })
        ) as unknown as Json,
        categories: categories.map(({ id, name }) => ({ id, name })) as unknown as Json,
      };
      await onSave(name.trim() || `Snapshot ${new Date().toLocaleDateString()}`, snapshot);
      setName('');
      toast({ title: 'Snapshot saved' });
    } catch (e: any) {
      toast({ title: 'Error saving snapshot', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRestore = async (point: RestorePoint) => {
    try {
      await onRestore(point.data);
      toast({ title: 'Restored', description: `Restored from "${point.name}"` });
    } catch (e: any) {
      toast({ title: 'Error restoring', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await onRemove(id);
    } catch (e: any) {
      toast({ title: 'Error deleting snapshot', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Save Snapshot</CardTitle>
          <CardDescription>Save the current state of all incomes, expenses, and categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Snapshot name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 shrink-0">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restore Points</CardTitle>
          <CardDescription>{points.length} snapshots</CardDescription>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No snapshots yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map(pt => (
                  <TableRow key={pt.id}>
                    <TableCell className="font-medium">{pt.name ?? 'Unnamed'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(pt.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleRestore(pt)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(pt.id)}>
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
