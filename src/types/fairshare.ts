export type FrequencyType = 'monthly' | 'twice_monthly' | 'weekly' | 'every_n_weeks' | 'annual' | 'k_times_annually';

export interface Household {
  id: string;
  partnerX: string; // display name
  partnerY: string; // display name
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  householdId: string;
}

export interface IncomeStream {
  id: string;
  householdId: string;
  partner: 'X' | 'Y';
  name: string;
  amount: number;
  frequencyType: FrequencyType;
  frequencyParam?: number; // e.g. n for every_n_weeks, k for k_times_annually
}

export interface Expense {
  id: string;
  householdId: string;
  name: string;
  categoryId: string | null;
  amount: number;
  frequencyType: FrequencyType;
  frequencyParam?: number;
  payer: 'X' | 'Y';
  benefitX: number; // 0-100
}

export interface RestorePoint {
  id: string;
  householdId: string;
  name: string;
  createdAt: string;
  data: {
    categories: Category[];
    incomes: IncomeStream[];
    expenses: Expense[];
  };
}
