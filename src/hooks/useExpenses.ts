import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  payer: string;
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
      .from('expenses')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at');
    setExpenses((data as Expense[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (expense: Omit<Expense, 'id' | 'household_id'>) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('expenses').insert({
      id,
      household_id: householdId,
      ...expense,
    });
    if (error) throw error;
    await fetch();
  };

  const update = async (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => {
    // Optimistically update local state so UI reacts immediately
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    try {
      const { error } = await supabase.from('expenses').update(updates).eq('id', id);
      if (error) throw error;
    } catch (e: any) {
      // "Load failed" is a browser fetch abort from concurrent requests — not a real error
      if (e instanceof TypeError && e.message === 'Load failed') {
        // silently ignore; refetch will reconcile
      } else {
        throw e;
      }
    }
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { expenses, loading, add, update, remove, refetch: fetch };
}
