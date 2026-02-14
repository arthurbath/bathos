import { useLocalStorage } from './useLocalStorage';
import { Household, Category, IncomeStream, Expense, RestorePoint } from '@/types/fairshare';

export function useHousehold() {
  const [household, setHousehold] = useLocalStorage<Household | null>('fairshare_household', null);
  const [categories, setCategories] = useLocalStorage<Category[]>('fairshare_categories', []);
  const [incomes, setIncomes] = useLocalStorage<IncomeStream[]>('fairshare_incomes', []);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('fairshare_expenses', []);
  const [restorePoints, setRestorePoints] = useLocalStorage<RestorePoint[]>('fairshare_restore_points', []);

  return {
    household, setHousehold,
    categories, setCategories,
    incomes, setIncomes,
    expenses, setExpenses,
    restorePoints, setRestorePoints,
  };
}
