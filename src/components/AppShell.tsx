import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, PieChart, BarChart3, Tag, History, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface AppShellProps {
  household: HouseholdData;
  onSignOut: () => void;
}

export function AppShell({ household, onSignOut }: AppShellProps) {
  const { incomes, add: addIncome, remove: removeIncome, refetch: refetchIncomes } = useIncomes(household.householdId);
  const { expenses, add: addExpense, remove: removeExpense, refetch: refetchExpenses } = useExpenses(household.householdId);
  const { categories, add: addCategory, remove: removeCategory, refetch: refetchCategories } = useCategories(household.householdId);
  const { points, save: savePoint, remove: removePoint } = useRestorePoints(household.householdId);

  const handleRestore = async (data: Json) => {
    const snap = data as { incomes?: any[]; expenses?: any[]; categories?: any[] };
    const hid = household.householdId;

    // Clear existing data
    await supabase.from('expenses').delete().eq('household_id', hid);
    await supabase.from('income_streams').delete().eq('household_id', hid);
    await supabase.from('categories').delete().eq('household_id', hid);

    // Restore categories
    if (snap.categories?.length) {
      await supabase.from('categories').insert(
        snap.categories.map((c: any) => ({ id: crypto.randomUUID(), household_id: hid, name: c.name }))
      );
    }

    // Restore incomes
    if (snap.incomes?.length) {
      await supabase.from('income_streams').insert(
        snap.incomes.map((i: any) => ({
          id: crypto.randomUUID(),
          household_id: hid,
          name: i.name,
          amount: i.amount,
          frequency_type: i.frequency_type,
          frequency_param: i.frequency_param,
          partner_label: i.partner_label,
        }))
      );
    }

    // Restore expenses (category_id won't match old IDs, so null them out)
    if (snap.expenses?.length) {
      await supabase.from('expenses').insert(
        snap.expenses.map((e: any) => ({
          id: crypto.randomUUID(),
          household_id: hid,
          name: e.name,
          amount: e.amount,
          frequency_type: e.frequency_type,
          frequency_param: e.frequency_param,
          payer: e.payer,
          benefit_x: e.benefit_x,
          category_id: null,
        }))
      );
    }

    // Refetch all
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
            <Button variant="ghost" size="icon" onClick={onSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
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
              onRemove={removeIncome}
            />
          </TabsContent>
          <TabsContent value="expenses">
            <ExpensesTab
              expenses={expenses}
              categories={categories}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              onAdd={addExpense}
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
              onAdd={addCategory}
              onRemove={removeCategory}
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
