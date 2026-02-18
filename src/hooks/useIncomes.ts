import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  partner_label: string;
  household_id: string;
}

export function useIncomes(householdId: string) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const sortByCreatedAt = (rows: Income[]) =>
    [...rows].sort((a, b) => {
      const aCreated = (a as unknown as { created_at?: string }).created_at ?? '';
      const bCreated = (b as unknown as { created_at?: string }).created_at ?? '';
      return aCreated.localeCompare(bCreated);
    });

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('budget_income_streams')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at');
    setIncomes((data as Income[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (income: Omit<Income, 'id' | 'household_id'>) => {
    const id = crypto.randomUUID();
    const optimistic: Income = { id, household_id: householdId, ...income };
    setIncomes(prev => sortByCreatedAt([...prev, optimistic]));

    const { data, error } = await supabase.from('budget_income_streams').insert({
      id,
      household_id: householdId,
      ...income,
    }).select('*').single();
    if (error) {
      setIncomes(prev => prev.filter(i => i.id !== id));
      throw error;
    }
    if (data) {
      setIncomes(prev => sortByCreatedAt(prev.map(i => (i.id === id ? (data as Income) : i))));
    }
  };

  const update = async (id: string, updates: Partial<Omit<Income, 'id' | 'household_id'>>) => {
    const prevIncomes = incomes;
    setIncomes(prev => sortByCreatedAt(prev.map(i => i.id === id ? { ...i, ...updates } : i)));
    const { data, error } = await supabase.from('budget_income_streams').update(updates).eq('id', id).select('*').single();
    if (error) {
      setIncomes(prevIncomes);
      throw error;
    }
    if (data) {
      setIncomes(prev => sortByCreatedAt(prev.map(i => (i.id === id ? (data as Income) : i))));
    }
  };

  const remove = async (id: string) => {
    const prevIncomes = incomes;
    setIncomes(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('budget_income_streams').delete().eq('id', id);
    if (error) {
      setIncomes(prevIncomes);
      throw error;
    }
  };

  return { incomes, loading, add, update, remove, refetch: fetch };
}
