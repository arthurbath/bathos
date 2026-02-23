export const budgetQueryKeys = {
  household: (userId: string | null) => ['budget', 'household', userId] as const,
  budgets: (householdId: string) => ['budget', 'budgets', householdId] as const,
  categories: (householdId: string) => ['budget', 'categories', householdId] as const,
  linkedAccounts: (householdId: string) => ['budget', 'linkedAccounts', householdId] as const,
  incomes: (householdId: string) => ['budget', 'incomes', householdId] as const,
  expenses: (householdId: string) => ['budget', 'expenses', householdId] as const,
  restorePoints: (householdId: string) => ['budget', 'restorePoints', householdId] as const,
};
