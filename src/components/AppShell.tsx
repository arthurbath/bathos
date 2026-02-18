import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DollarSign, PieChart, BarChart3, Settings, History } from 'lucide-react';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { toast } from '@/hooks/use-toast';
import type { HouseholdData } from '@/hooks/useHouseholdData';
import { useIncomes } from '@/hooks/useIncomes';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { ToplineHeader } from '@/platform/components/ToplineHeader';

import { useLinkedAccounts } from '@/hooks/useLinkedAccounts';
import { useRestorePoints } from '@/hooks/useRestorePoints';
import { IncomesTab } from '@/components/IncomesTab';
import { ExpensesTab } from '@/components/ExpensesTab';
import { ConfigurationTab } from '@/components/ConfigurationTab';
import { SummaryTab } from '@/components/SummaryTab';
import { RestoreTab } from '@/components/RestoreTab';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface AppShellProps {
  household: HouseholdData;
  userId: string;
  onSignOut: () => void;
  onHouseholdRefetch: () => void;
  onUpdatePartnerNames: (x: string, y: string) => Promise<void>;
  onUpdatePartnerColors: (xColor: string | null, yColor: string | null) => Promise<void>;
}

export function AppShell({ household, userId, onSignOut, onHouseholdRefetch, onUpdatePartnerNames, onUpdatePartnerColors }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const { incomes, add: addIncome, update: updateIncome, remove: removeIncome, refetch: refetchIncomes } = useIncomes(household.householdId);
  const { expenses, add: addExpense, update: updateExpense, remove: removeExpense, refetch: refetchExpenses } = useExpenses(household.householdId);
  const { categories, add: addCategory, update: updateCategory, updateColor: updateCategoryColor, remove: removeCategory, refetch: refetchCategories } = useCategories(household.householdId);
  
  const { linkedAccounts, add: addLinkedAccount, update: updateLinkedAccount, updateColor: updateLinkedAccountColor, remove: removeLinkedAccount, refetch: refetchLinkedAccounts } = useLinkedAccounts(household.householdId);
  const { points, save: savePoint, remove: removePoint } = useRestorePoints(household.householdId);

  const handleReassignCategory = async (oldId: string, newId: string | null) => {
    const { error } = await supabase
      .from('budget_expenses')
      .update({ category_id: newId })
      .eq('household_id', household.householdId)
      .eq('category_id', oldId);
    if (error) throw error;
    await refetchExpenses();
  };


  const handleReassignLinkedAccount = async (oldId: string, newId: string | null) => {
    const { error } = await supabase
      .from('budget_expenses')
      .update({ linked_account_id: newId })
      .eq('household_id', household.householdId)
      .eq('linked_account_id', oldId);
    if (error) throw error;
    await refetchExpenses();
  };

  const handleSyncPayerForAccount = async (accountId: string, ownerPartner: string) => {
    const { error } = await supabase
      .from('budget_expenses')
      .update({ payer: ownerPartner })
      .eq('household_id', household.householdId)
      .eq('linked_account_id', accountId);
    if (error) throw error;
    await refetchExpenses();
  };

  const handleRestore = async (data: Json) => {
    const snap = data as { incomes?: any[]; expenses?: any[]; categories?: any[] };
    const hid = household.householdId;

    await supabase.from('budget_expenses').delete().eq('household_id', hid);
    await supabase.from('budget_income_streams').delete().eq('household_id', hid);
    await supabase.from('budget_categories').delete().eq('household_id', hid);

    if (snap.categories?.length) {
      await supabase.from('budget_categories').insert(
        snap.categories.map((c: any) => ({ id: crypto.randomUUID(), household_id: hid, name: c.name }))
      );
    }
    if (snap.incomes?.length) {
      await supabase.from('budget_income_streams').insert(
        snap.incomes.map((i: any) => ({
          id: crypto.randomUUID(), household_id: hid,
          name: i.name, amount: i.amount, frequency_type: i.frequency_type,
          frequency_param: i.frequency_param, partner_label: i.partner_label,
        }))
      );
    }
    if (snap.expenses?.length) {
      await supabase.from('budget_expenses').insert(
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
      <ToplineHeader title="Budget" userId={userId} displayName={household.displayName} onSignOut={onSignOut} />

      <main className={`mx-auto max-w-5xl px-4 pt-6 space-y-6 ${location.pathname.endsWith('/expenses') || location.pathname.endsWith('/incomes') ? 'pb-0' : 'pb-6'}`}>
        <nav className="grid w-full grid-cols-5 rounded-lg bg-muted p-1 text-muted-foreground">
          {([
            { path: '/summary', icon: PieChart, label: 'Summary' },
            { path: '/expenses', icon: BarChart3, label: 'Expenses' },
            { path: '/incomes', icon: DollarSign, label: 'Incomes' },
            { path: '/config', icon: Settings, label: 'Config' },
            { path: '/restore', icon: History, label: 'Backup' },
          ] as const).map(({ path, icon: Icon, label }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(fullPath)}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${active ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50'}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        {location.pathname.endsWith('/incomes') && (
          <IncomesTab
            incomes={incomes}
            partnerX={household.partnerX}
            partnerY={household.partnerY}
            onAdd={addIncome}
            onUpdate={updateIncome}
            onRemove={removeIncome}
          />
        )}
        {location.pathname.endsWith('/expenses') && (
          <ExpensesTab
            expenses={expenses}
            categories={categories}
            linkedAccounts={linkedAccounts}
            incomes={incomes}
            partnerX={household.partnerX}
            partnerY={household.partnerY}
            partnerXColor={household.partnerXColor}
            partnerYColor={household.partnerYColor}
            onAdd={addExpense}
            onUpdate={updateExpense}
            onRemove={removeExpense}
            onAddCategory={addCategory}
            onAddLinkedAccount={addLinkedAccount}
          />
        )}
        {location.pathname.endsWith('/summary') && (
          <SummaryTab
            incomes={incomes}
            expenses={expenses}
            partnerX={household.partnerX}
            partnerY={household.partnerY}
          />
        )}
        {location.pathname.endsWith('/config') && (
          <ConfigurationTab
            categories={categories}
            linkedAccounts={linkedAccounts}
            expenses={expenses}
            partnerX={household.partnerX}
            partnerY={household.partnerY}
            partnerXColor={household.partnerXColor}
            partnerYColor={household.partnerYColor}
            inviteCode={household.inviteCode}
            onUpdatePartnerNames={onUpdatePartnerNames}
            onUpdatePartnerColors={onUpdatePartnerColors}
            onAddCategory={addCategory}
            onUpdateCategory={updateCategory}
            onRemoveCategory={removeCategory}
            onReassignCategory={handleReassignCategory}
            onUpdateCategoryColor={updateCategoryColor}
            onAddLinkedAccount={addLinkedAccount}
            onUpdateLinkedAccount={updateLinkedAccount}
            onRemoveLinkedAccount={removeLinkedAccount}
            onReassignLinkedAccount={handleReassignLinkedAccount}
            onUpdateLinkedAccountColor={updateLinkedAccountColor}
            onSyncPayerForAccount={handleSyncPayerForAccount}
          />
        )}
        {location.pathname.endsWith('/restore') && (
          <RestoreTab
            points={points}
            incomes={incomes}
            expenses={expenses}
            categories={categories}
            onSave={savePoint}
            onRemove={removePoint}
            onRestore={handleRestore}
          />
        )}
      </main>
    </div>
  );
}
