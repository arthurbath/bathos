import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DollarSign, PieChart, BarChart3, Settings } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { getAvailableModules } from '@/platform/modules';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';
import { withMutationTiming } from '@/lib/mutationTiming';

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
  const queryClient = useQueryClient();
  const basePath = useModuleBasePath();
  const isIncomesRoute = location.pathname.endsWith('/incomes');
  const isExpensesRoute = location.pathname.endsWith('/expenses');
  const isSummaryRoute = location.pathname.endsWith('/summary');
  const isConfigRoute = location.pathname.endsWith('/config');
  const isFullViewGridRoute = isExpensesRoute;
  const {
    incomes,
    add: addIncome,
    update: updateIncome,
    remove: removeIncome,
    pendingById: incomePendingById = {},
  } = useIncomes(household.householdId);
  const {
    expenses,
    add: addExpense,
    update: updateExpense,
    remove: removeExpense,
    pendingById: expensePendingById = {},
  } = useExpenses(household.householdId);
  const {
    categories,
    add: addCategory,
    update: updateCategory,
    updateColor: updateCategoryColor,
    remove: removeCategory,
    pendingById: categoryPendingById = {},
  } = useCategories(household.householdId);
  
  const {
    linkedAccounts,
    add: addLinkedAccount,
    update: updateLinkedAccount,
    updateColor: updateLinkedAccountColor,
    remove: removeLinkedAccount,
    pendingById: linkedAccountPendingById = {},
  } = useLinkedAccounts(household.householdId);
  const { points, save: savePoint, remove: removePoint, updateNotes: updateRestorePointNotes } = useRestorePoints(household.householdId);
  const showAppSwitcher = getAvailableModules().length > 1;

  const handleReassignCategory = async (oldId: string, newId: string | null) => {
    await withMutationTiming({ module: 'budget', action: 'categories.reassignAndDelete' }, async () => {
      const { error } = await supabase.rpc('budget_reassign_category_and_delete', {
        _household_id: household.householdId,
        _old_category_id: oldId,
        _new_category_id: newId,
      });
      if (error) throw error;
    });

    queryClient.setQueryData(
      budgetQueryKeys.categories(household.householdId),
      categories.filter((category) => category.id !== oldId),
    );
    queryClient.setQueryData(
      budgetQueryKeys.expenses(household.householdId),
      expenses.map((expense) =>
        expense.category_id === oldId ? { ...expense, category_id: newId } : expense,
      ),
    );
  };


  const handleReassignLinkedAccount = async (oldId: string, newId: string | null) => {
    await withMutationTiming({ module: 'budget', action: 'linkedAccounts.reassignAndDelete' }, async () => {
      const { error } = await supabase.rpc('budget_reassign_linked_account_and_delete', {
        _household_id: household.householdId,
        _old_linked_account_id: oldId,
        _new_linked_account_id: newId,
      });
      if (error) throw error;
    });

    queryClient.setQueryData(
      budgetQueryKeys.linkedAccounts(household.householdId),
      linkedAccounts.filter((linkedAccount) => linkedAccount.id !== oldId),
    );
    queryClient.setQueryData(
      budgetQueryKeys.expenses(household.householdId),
      expenses.map((expense) =>
        expense.linked_account_id === oldId ? { ...expense, linked_account_id: newId } : expense,
      ),
    );
  };

  const handleRestore = async (data: Json) => {
    const restored = await withMutationTiming({ module: 'budget', action: 'restore.apply' }, async () => {
      const { data: restoredData, error } = await supabase.rpc('budget_restore_household_snapshot', {
        _household_id: household.householdId,
        _snapshot: data,
      });
      if (error) throw error;
      return restoredData as {
        categories?: unknown[];
        linkedAccounts?: unknown[];
        incomes?: unknown[];
        expenses?: unknown[];
      };
    });

    queryClient.setQueryData(budgetQueryKeys.categories(household.householdId), restored.categories ?? []);
    queryClient.setQueryData(
      budgetQueryKeys.linkedAccounts(household.householdId),
      restored.linkedAccounts ?? [],
    );
    queryClient.setQueryData(budgetQueryKeys.incomes(household.householdId), restored.incomes ?? []);
    queryClient.setQueryData(budgetQueryKeys.expenses(household.householdId), restored.expenses ?? []);
  };

  return (
    <div className={`bg-background ${isFullViewGridRoute ? 'h-dvh overflow-y-hidden overflow-x-visible flex flex-col' : 'min-h-screen'}`}>
      <ToplineHeader title="Budget" userId={userId} displayName={household.displayName} onSignOut={onSignOut} showAppSwitcher={showAppSwitcher} />

      <div className="mx-auto max-w-5xl w-full px-4 pt-6">
        <nav className="grid w-full grid-cols-4 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-border p-1 text-muted-foreground">
          {([
            { path: '/summary', icon: PieChart, label: 'Summary' },
            { path: '/expenses', icon: BarChart3, label: 'Expenses' },
            { path: '/incomes', icon: DollarSign, label: 'Incomes' },
            { path: '/config', icon: Settings, label: 'Config' },
          ] as const).map(({ path, icon: Icon, label }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(fullPath)}
                className={`inline-flex items-center justify-center gap-0 sm:gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${active ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50'}`}
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {isFullViewGridRoute ? (
        <main className="flex w-full flex-1 min-h-0 flex-col pt-6 pb-0">
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
                pendingById={expensePendingById}
                onAddCategory={addCategory}
                onAddLinkedAccount={addLinkedAccount}
                fullView
              />
            </div>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-6 space-y-6">
          {isIncomesRoute && (
            <IncomesTab
              incomes={incomes}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              userId={userId}
              onAdd={addIncome}
              onUpdate={updateIncome}
              onRemove={removeIncome}
              pendingById={incomePendingById}
            />
          )}
          {isSummaryRoute && (
            <SummaryTab
              incomes={incomes}
              expenses={expenses}
              linkedAccounts={linkedAccounts}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              userId={userId}
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
              categoryPendingById={categoryPendingById}
              onAddLinkedAccount={addLinkedAccount}
              onUpdateLinkedAccount={updateLinkedAccount}
              onRemoveLinkedAccount={removeLinkedAccount}
              onReassignLinkedAccount={handleReassignLinkedAccount}
              onUpdateLinkedAccountColor={updateLinkedAccountColor}
              linkedAccountPendingById={linkedAccountPendingById}
              points={points}
              incomes={incomes}
              onSaveRestorePoint={savePoint}
              onRemoveRestorePoint={removePoint}
              onUpdateRestorePointNotes={updateRestorePointNotes}
              onRestore={handleRestore}
            />
          )}
        </main>
      )}
    </div>
  );
}
