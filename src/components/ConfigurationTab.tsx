import { ManagedListSection } from '@/components/ManagedListSection';
import type { Category } from '@/hooks/useCategories';
import type { Budget } from '@/hooks/useBudgets';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Expense } from '@/hooks/useExpenses';

interface ConfigurationTabProps {
  categories: Category[];
  budgets: Budget[];
  linkedAccounts: LinkedAccount[];
  expenses: Expense[];
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onRemoveCategory: (id: string) => Promise<void>;
  onReassignCategory: (oldId: string, newId: string | null) => Promise<void>;
  onAddBudget: (name: string) => Promise<void>;
  onUpdateBudget: (id: string, name: string) => Promise<void>;
  onRemoveBudget: (id: string) => Promise<void>;
  onReassignBudget: (oldId: string, newId: string | null) => Promise<void>;
  onAddLinkedAccount: (name: string) => Promise<void>;
  onUpdateLinkedAccount: (id: string, name: string) => Promise<void>;
  onRemoveLinkedAccount: (id: string) => Promise<void>;
  onReassignLinkedAccount: (oldId: string, newId: string | null) => Promise<void>;
}

export function ConfigurationTab({
  categories, budgets, linkedAccounts, expenses,
  onAddCategory, onUpdateCategory, onRemoveCategory, onReassignCategory,
  onAddBudget, onUpdateBudget, onRemoveBudget, onReassignBudget,
  onAddLinkedAccount, onUpdateLinkedAccount, onRemoveLinkedAccount, onReassignLinkedAccount,
}: ConfigurationTabProps) {
  return (
    <div className="space-y-6">
      <ManagedListSection
        title="Categories"
        description="Organize expenses into categories."
        items={categories}
        getUsageCount={(id) => expenses.filter(e => e.category_id === id).length}
        onAdd={onAddCategory}
        onUpdate={onUpdateCategory}
        onRemove={onRemoveCategory}
        onReassign={onReassignCategory}
      />
      <ManagedListSection
        title="Budgets"
        description="Define budget buckets like Fixed Essentials, Flexible, etc."
        items={budgets}
        getUsageCount={(id) => expenses.filter(e => e.budget_id === id).length}
        onAdd={onAddBudget}
        onUpdate={onUpdateBudget}
        onRemove={onRemoveBudget}
        onReassign={onReassignBudget}
      />
      <ManagedListSection
        title="Payment Methods"
        description="Track which payment method or account is used."
        items={linkedAccounts}
        getUsageCount={(id) => expenses.filter(e => e.linked_account_id === id).length}
        onAdd={onAddLinkedAccount}
        onUpdate={onUpdateLinkedAccount}
        onRemove={onRemoveLinkedAccount}
        onReassign={onReassignLinkedAccount}
      />
    </div>
  );
}
