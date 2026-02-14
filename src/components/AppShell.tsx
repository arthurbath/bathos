import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, PieChart, BarChart3, Tag, History, LogOut, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import type { HouseholdData } from '@/hooks/useHouseholdData';
import { useIncomes } from '@/hooks/useIncomes';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { useRestorePoints } from '@/hooks/useRestorePoints';
import { IncomesTab } from '@/components/IncomesTab';
import { ExpensesTab } from '@/components/ExpensesTab';
import { CategoriesTab } from '@/components/CategoriesTab';
import { SummaryTab } from '@/components/SummaryTab';
import { RestoreTab } from '@/components/RestoreTab';
import { InvitePartner } from '@/components/InvitePartner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface AppShellProps {
  household: HouseholdData;
  userId: string;
  onSignOut: () => void;
  onHouseholdRefetch: () => void;
}

export function AppShell({ household, userId, onSignOut, onHouseholdRefetch }: AppShellProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEditName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName.trim() })
      .eq('id', userId);
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to update name', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Display name updated' });
      setEditOpen(false);
      onHouseholdRefetch();
    }
  };
  const { incomes, add: addIncome, update: updateIncome, remove: removeIncome, refetch: refetchIncomes } = useIncomes(household.householdId);
  const { expenses, add: addExpense, update: updateExpense, remove: removeExpense, refetch: refetchExpenses } = useExpenses(household.householdId);
  const { categories, add: addCategory, update: updateCategory, remove: removeCategory, refetch: refetchCategories } = useCategories(household.householdId);
  const { points, save: savePoint, remove: removePoint } = useRestorePoints(household.householdId);

  const handleReassignExpenses = async (oldCategoryId: string, newCategoryId: string | null) => {
    const { error } = await supabase
      .from('expenses')
      .update({ category_id: newCategoryId })
      .eq('household_id', household.householdId)
      .eq('category_id', oldCategoryId);
    if (error) throw error;
    await refetchExpenses();
  };

  const handleRestore = async (data: Json) => {
    const snap = data as { incomes?: any[]; expenses?: any[]; categories?: any[] };
    const hid = household.householdId;

    await supabase.from('expenses').delete().eq('household_id', hid);
    await supabase.from('income_streams').delete().eq('household_id', hid);
    await supabase.from('categories').delete().eq('household_id', hid);

    if (snap.categories?.length) {
      await supabase.from('categories').insert(
        snap.categories.map((c: any) => ({ id: crypto.randomUUID(), household_id: hid, name: c.name }))
      );
    }
    if (snap.incomes?.length) {
      await supabase.from('income_streams').insert(
        snap.incomes.map((i: any) => ({
          id: crypto.randomUUID(), household_id: hid,
          name: i.name, amount: i.amount, frequency_type: i.frequency_type,
          frequency_param: i.frequency_param, partner_label: i.partner_label,
        }))
      );
    }
    if (snap.expenses?.length) {
      await supabase.from('expenses').insert(
        snap.expenses.map((e: any) => ({
          id: crypto.randomUUID(), household_id: hid,
          name: e.name, amount: e.amount, frequency_type: e.frequency_type,
          frequency_param: e.frequency_param, payer: e.payer, benefit_x: e.benefit_x,
          category_id: null,
        }))
      );
    }

    await Promise.all([refetchIncomes(), refetchExpenses(), refetchCategories()]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">Split</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {household.partnerX} & {household.partnerY}
            </span>
            <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (open) setNewName(household.myLabel === 'X' ? household.partnerX : household.partnerY); }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Edit display name">
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Edit display name</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Your name" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleEditName()} />
                  <Button className="w-full" disabled={!newName.trim() || saving} onClick={handleEditName}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={onSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {!household.hasBothPartners && (
          <InvitePartner householdId={household.householdId} inviteCode={household.inviteCode} />
        )}

        <Tabs defaultValue="incomes">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="incomes" className="gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Incomes</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 text-xs sm:text-sm">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="restore" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Restore</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incomes">
            <IncomesTab
              incomes={incomes}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              onAdd={addIncome}
              onUpdate={updateIncome}
              onRemove={removeIncome}
            />
          </TabsContent>
          <TabsContent value="expenses">
            <ExpensesTab
              expenses={expenses}
              categories={categories}
              incomes={incomes}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              onAdd={addExpense}
              onUpdate={updateExpense}
              onRemove={removeExpense}
            />
          </TabsContent>
          <TabsContent value="summary">
            <SummaryTab
              incomes={incomes}
              expenses={expenses}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
            />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTab
              categories={categories}
              expenses={expenses}
              onAdd={addCategory}
              onUpdate={updateCategory}
              onRemove={removeCategory}
              onReassignExpenses={handleReassignExpenses}
            />
          </TabsContent>
          <TabsContent value="restore">
            <RestoreTab
              points={points}
              incomes={incomes}
              expenses={expenses}
              categories={categories}
              onSave={savePoint}
              onRemove={removePoint}
              onRestore={handleRestore}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
