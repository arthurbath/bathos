import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  payer: string | null;
  benefit_x: number;
  category_id: string | null;
  household_id: string;
  is_estimate: boolean;
  budget_id: string | null;
  linked_account_id: string | null;
}

export function useExpenses(householdId: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('budget_expenses')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at');
    setExpenses((data as Expense[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (expense: Omit<Expense, 'id' | 'household_id'>) => {
    const id = crypto.randomUUID();
    try {
      const { error } = await supabase.from('budget_expenses').insert({
        id,
        household_id: householdId,
        ...expense,
      });
      if (error) throw error;
      await fetch();
    } catch (e: any) {
      if (e instanceof TypeError && e.message === 'Load failed') {
        await fetch();
      } else {
        throw e;
      }
    }
  };

  const update = async (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    try {
      const { error } = await supabase.from('budget_expenses').update(updates).eq('id', id);
      if (error) throw error;
      await fetch();
    } catch (e: any) {
      if (e instanceof TypeError && e.message === 'Load failed') {
        // silently ignore
      } else {
        throw e;
      }
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('budget_expenses').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { expenses, loading, add, update, remove, refetch: fetch };
}
