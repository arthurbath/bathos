import { useLocation, useNavigate } from 'react-router-dom';
import { PieChart, Settings, Banknote as BanknoteArrowUp, HandCoins } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import type { HouseholdData } from '@/hooks/useHouseholdData';
import { useIncomes } from '@/hooks/useIncomes';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';

import { useLinkedAccounts } from '@/hooks/useLinkedAccounts';
import { useRestorePoints } from '@/hooks/useRestorePoints';
import { IncomesTab } from '@/components/IncomesTab';
import { ExpensesTab } from '@/components/ExpensesTab';
import { ConfigurationTab } from '@/components/ConfigurationTab';
import { SummaryTab } from '@/components/SummaryTab';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { getAvailableModules } from '@/platform/modules';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';
import { withMutationTiming } from '@/lib/mutationTiming';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import type { HouseholdMember } from '@/platform/households';

interface AppShellProps {
  household: HouseholdData;
  userId: string;
  displayName: string;
  userEmail: string;
  onSignOut: () => void;
  onUpdatePartnerSettings: (input: {
    partnerXName: string;
    partnerYName: string;
    wageGapAdjustmentEnabled: boolean;
    partnerXWageCentsPerDollar: number | null;
    partnerYWageCentsPerDollar: number | null;
  }) => Promise<void>;
  householdMembers: HouseholdMember[];
  householdMembersLoading: boolean;
  householdMembersError: string | null;
  pendingHouseholdMemberId: string | null;
  rotatingHouseholdInviteCode: boolean;
  leavingHousehold: boolean;
  deletingHousehold: boolean;
  onRotateHouseholdInviteCode: () => Promise<void>;
  onRemoveHouseholdMember: (memberUserId: string) => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteHousehold: () => Promise<void>;
}

export function AppShell({
  household,
  userId,
  displayName,
  userEmail,
  onSignOut,
  onUpdatePartnerSettings,
  householdMembers,
  householdMembersLoading,
  householdMembersError,
  pendingHouseholdMemberId,
  rotatingHouseholdInviteCode,
  leavingHousehold,
  deletingHousehold,
  onRotateHouseholdInviteCode,
  onRemoveHouseholdMember,
  onLeaveHousehold,
  onDeleteHousehold,
}: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const basePath = useModuleBasePath();
  const isIncomesRoute = location.pathname.endsWith('/incomes');
  const isExpensesRoute = location.pathname.endsWith('/expenses');
  const isSummaryRoute = location.pathname.endsWith('/summary');
  const isConfigRoute = location.pathname.endsWith('/config');
  const isMobile = useIsMobile();
  const isMobileIncomesFullViewRoute = isIncomesRoute && isMobile;
  const isFullViewGridRoute = isExpensesRoute || isMobileIncomesFullViewRoute;
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
  const budgetNavItems = [
    { path: '/summary', icon: PieChart, label: 'Summary' },
    { path: '/expenses', icon: BanknoteArrowUp, label: 'Expenses' },
    { path: '/incomes', icon: HandCoins, label: 'Incomes' },
    { path: '/config', icon: Settings, label: 'Config' },
  ] as const;

  const handleReassignCategory = async (oldId: string, newId: string | null) => {
    try {
      await withMutationTiming({ module: 'budget', action: 'categories.reassignAndDelete' }, async () => {
        await supabaseRequest(async () =>
          await supabase.rpc('budget_reassign_category_and_delete', {
            _household_id: household.householdId,
            _old_category_id: oldId,
            _new_category_id: newId,
          }),
        );
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
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  };


  const handleReassignLinkedAccount = async (oldId: string, newId: string | null) => {
    try {
      await withMutationTiming({ module: 'budget', action: 'linkedAccounts.reassignAndDelete' }, async () => {
        await supabaseRequest(async () =>
          await supabase.rpc('budget_reassign_linked_account_and_delete', {
            _household_id: household.householdId,
            _old_linked_account_id: oldId,
            _new_linked_account_id: newId,
          }),
        );
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
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  };

  const handleRestore = async (data: Json) => {
    try {
      const restored = await withMutationTiming({ module: 'budget', action: 'restore.apply' }, async () => {
        const restoredData = await supabaseRequest(async () =>
          await supabase.rpc('budget_restore_household_snapshot', {
            _household_id: household.householdId,
            _snapshot: data,
          }),
        );
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
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  };

  return (
    <div className={`relative isolate bg-background ${isFullViewGridRoute ? 'h-dvh overflow-y-hidden overflow-x-visible flex flex-col' : 'min-h-screen'}`}>
      <ToplineHeader
        title="Budget"
        moduleId="budget"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher={showAppSwitcher}
      />

      <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 md:block">
        <nav className="hidden w-full grid-cols-4 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground md:grid">
          {budgetNavItems.map(({ path, icon: Icon, label }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <a
                key={path}
                href={fullPath}
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, fullPath)}
                className={`inline-flex items-center justify-center gap-0 sm:gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>
      <MobileBottomNav
        items={budgetNavItems}
        isActive={(path) => {
          const fullPath = `${basePath}${path}`;
          return location.pathname === fullPath || location.pathname === path;
        }}
        hrefForPath={(path) => `${basePath}${path}`}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
      />

      {isFullViewGridRoute ? (
        <main className="flex w-full flex-1 min-h-0 flex-col pt-0 pb-[calc(env(safe-area-inset-bottom)+3.75rem)] md:pt-6 md:pb-0">
          {isExpensesRoute && (
            <div className="flex-1 min-h-0">
              <ExpensesTab
                expenses={expenses}
                categories={categories}
                linkedAccounts={linkedAccounts}
              incomes={incomes}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              wageGapAdjustmentEnabled={household.wageGapAdjustmentEnabled}
              partnerXWageCentsPerDollar={household.partnerXWageCentsPerDollar}
              partnerYWageCentsPerDollar={household.partnerYWageCentsPerDollar}
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
          {isMobileIncomesFullViewRoute && (
            <div className="flex-1 min-h-0">
              <IncomesTab
                incomes={incomes}
                partnerX={household.partnerX}
                partnerY={household.partnerY}
                wageGapAdjustmentEnabled={household.wageGapAdjustmentEnabled}
                userId={userId}
                onAdd={addIncome}
                onUpdate={updateIncome}
                onRemove={removeIncome}
                pendingById={incomePendingById}
                fullView
              />
            </div>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 md:pb-6 space-y-6">
          {isIncomesRoute && (
            <IncomesTab
              incomes={incomes}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              wageGapAdjustmentEnabled={household.wageGapAdjustmentEnabled}
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
              wageGapAdjustmentEnabled={household.wageGapAdjustmentEnabled}
              partnerXWageCentsPerDollar={household.partnerXWageCentsPerDollar}
              partnerYWageCentsPerDollar={household.partnerYWageCentsPerDollar}
              userId={userId}
            />
          )}
          {isConfigRoute && (
            <ConfigurationTab
              userId={userId}
              categories={categories}
              linkedAccounts={linkedAccounts}
              expenses={expenses}
              partnerX={household.partnerX}
              partnerY={household.partnerY}
              wageGapAdjustmentEnabled={household.wageGapAdjustmentEnabled}
              partnerXWageCentsPerDollar={household.partnerXWageCentsPerDollar}
              partnerYWageCentsPerDollar={household.partnerYWageCentsPerDollar}
              userEmail={userEmail}
              inviteCode={household.inviteCode}
              householdMembers={householdMembers}
              householdMembersLoading={householdMembersLoading}
              householdMembersError={householdMembersError}
              pendingHouseholdMemberId={pendingHouseholdMemberId}
              rotatingHouseholdInviteCode={rotatingHouseholdInviteCode}
              leavingHousehold={leavingHousehold}
              deletingHousehold={deletingHousehold}
              onUpdatePartnerSettings={onUpdatePartnerSettings}
              onRotateHouseholdInviteCode={onRotateHouseholdInviteCode}
              onRemoveHouseholdMember={onRemoveHouseholdMember}
              onLeaveHousehold={onLeaveHousehold}
              onDeleteHousehold={onDeleteHousehold}
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
