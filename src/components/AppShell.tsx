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
}

export function AppShell({ household, userId, onSignOut, onHouseholdRefetch, onUpdatePartnerNames }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const isIncomesRoute = location.pathname.endsWith('/incomes');
  const isExpensesRoute = location.pathname.endsWith('/expenses');
  const isSummaryRoute = location.pathname.endsWith('/summary');
  const isConfigRoute = location.pathname.endsWith('/config');
  const isRestoreRoute = location.pathname.endsWith('/restore');
  const isFullViewGridRoute = isExpensesRoute || isIncomesRoute;
  const { incomes, add: addIncome, update: updateIncome, remove: removeIncome, refetch: refetchIncomes } = useIncomes(household.householdId);
  const { expenses, add: addExpense, update: updateExpense, remove: removeExpense, refetch: refetchExpenses } = useExpenses(household.householdId);
  const { categories, add: addCategory, update: updateCategory, updateColor: updateCategoryColor, remove: removeCategory, refetch: refetchCategories } = useCategories(household.householdId);
  
  const { linkedAccounts, add: addLinkedAccount, update: updateLinkedAccount, updateColor: updateLinkedAccountColor, remove: removeLinkedAccount, refetch: refetchLinkedAccounts } = useLinkedAccounts(household.householdId);
  const { points, save: savePoint, remove: removePoint, updateNotes: updateRestorePointNotes } = useRestorePoints(household.householdId);

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

  const handleRestore = async (data: Json) => {
    const snap = data as {
      incomes?: any[];
      expenses?: any[];
      categories?: any[];
      linkedAccounts?: any[];
    };
    const hid = household.householdId;

    await supabase.from('budget_expenses').delete().eq('household_id', hid);
    await supabase.from('budget_income_streams').delete().eq('household_id', hid);
    await supabase.from('budget_linked_accounts').delete().eq('household_id', hid);
    await supabase.from('budget_categories').delete().eq('household_id', hid);

    if (snap.categories?.length) {
      await supabase.from('budget_categories').insert(
        snap.categories.map((c: any) => ({
          id: c.id ?? crypto.randomUUID(),
          household_id: hid,
          name: c.name ?? '',
          color: c.color ?? null,
        }))
      );
    }
    if (snap.linkedAccounts?.length) {
      await supabase.from('budget_linked_accounts').insert(
        snap.linkedAccounts.map((a: any) => ({
          id: a.id ?? crypto.randomUUID(),
          household_id: hid,
          name: a.name ?? '',
          color: a.color ?? null,
          owner_partner: a.owner_partner ?? 'X',
        }))
      );
    }
    if (snap.incomes?.length) {
      await supabase.from('budget_income_streams').insert(
        snap.incomes.map((i: any) => ({
          id: i.id ?? crypto.randomUUID(),
          household_id: hid,
          name: i.name,
          amount: i.amount,
          frequency_type: i.frequency_type,
          frequency_param: i.frequency_param,
          partner_label: i.partner_label,
        }))
      );
    }
    if (snap.expenses?.length) {
      await supabase.from('budget_expenses').insert(
        snap.expenses.map((e: any) => ({
          id: e.id ?? crypto.randomUUID(),
          household_id: hid,
          name: e.name,
          amount: e.amount,
          frequency_type: e.frequency_type,
          frequency_param: e.frequency_param,
          benefit_x: e.benefit_x,
          category_id: e.category_id ?? null,
          linked_account_id: e.linked_account_id ?? null,
          budget_id: e.budget_id ?? null,
          is_estimate: e.is_estimate ?? false,
        }))
      );
    }

    await Promise.all([refetchIncomes(), refetchExpenses(), refetchCategories(), refetchLinkedAccounts()]);
  };

  return (
    <div className={`bg-background ${isFullViewGridRoute ? 'h-dvh overflow-y-hidden overflow-x-visible flex flex-col' : 'min-h-screen'}`}>
      <ToplineHeader title="Budget" userId={userId} displayName={household.displayName} onSignOut={onSignOut} />

      <div className="mx-auto max-w-5xl w-full px-4 pt-6">
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
      </div>

      {isFullViewGridRoute ? (
        <main className="flex w-full flex-1 min-h-0 flex-col pt-6 pb-0">
          {isIncomesRoute && (
            <div className="flex-1 min-h-0">
              <IncomesTab
                incomes={incomes}
                partnerX={household.partnerX}
                partnerY={household.partnerY}
                userId={userId}
                onAdd={addIncome}
                onUpdate={updateIncome}
                onRemove={removeIncome}
                fullView
              />
            </div>
          )}
          {isExpensesRoute && (
            <div className="flex-1 min-h-0">
              <ExpensesTab
                expenses={expenses}
                categories={categories}
                linkedAccounts={linkedAccounts}
                incomes={incomes}
                partnerX={household.partnerX}
                partnerY={household.partnerY}
                userId={userId}
                onAdd={addExpense}
                onUpdate={updateExpense}
                onRemove={removeExpense}
                onAddCategory={addCategory}
                onAddLinkedAccount={addLinkedAccount}
                fullView
              />
            </div>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-6 space-y-6">
          {isSummaryRoute && (
            <SummaryTab
              incomes={incomes}
              expenses={expenses}
              linkedAccounts={linkedAccounts}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
            />
          )}
          {isConfigRoute && (
            <ConfigurationTab
              categories={categories}
              linkedAccounts={linkedAccounts}
              expenses={expenses}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              inviteCode={household.inviteCode}
              onUpdatePartnerNames={onUpdatePartnerNames}
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
            />
          )}
          {isRestoreRoute && (
            <RestoreTab
              points={points}
              incomes={incomes}
              expenses={expenses}
              categories={categories}
              linkedAccounts={linkedAccounts}
              onSave={savePoint}
              onRemove={removePoint}
              onUpdateNotes={updateRestorePointNotes}
              onRestore={handleRestore}
            />
          )}
        </main>
      )}
    </div>
  );
}
