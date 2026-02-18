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
  const sortByCreatedAt = (rows: Expense[]) =>
    [...rows].sort((a, b) => {
      const aCreated = (a as unknown as { created_at?: string }).created_at ?? '';
      const bCreated = (b as unknown as { created_at?: string }).created_at ?? '';
      return aCreated.localeCompare(bCreated);
    });

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
    const optimistic: Expense = { id, household_id: householdId, ...expense };
    setExpenses(prev => sortByCreatedAt([...prev, optimistic]));

    try {
      const { data, error } = await supabase.from('budget_expenses').insert({
        id,
        household_id: householdId,
        ...expense,
      }).select('*').single();
      if (error) throw error;
      if (data) {
        setExpenses(prev => sortByCreatedAt(prev.map(e => (e.id === id ? (data as Expense) : e))));
      }
    } catch (e: any) {
      if (e instanceof TypeError && e.message === 'Load failed') {
        await fetch();
      } else {
        setExpenses(prev => prev.filter(e => e.id !== id));
        throw e;
      }
    }
  };

  const update = async (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => {
    const prevExpenses = expenses;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    try {
      const { data, error } = await supabase.from('budget_expenses').update(updates).eq('id', id).select('*').single();
      if (error) throw error;
      if (data) {
        setExpenses(prev => sortByCreatedAt(prev.map(e => (e.id === id ? (data as Expense) : e))));
      }
    } catch (e: any) {
      if (e instanceof TypeError && e.message === 'Load failed') {
        // silently ignore
      } else {
        setExpenses(prevExpenses);
        throw e;
      }
    }
  };

  const remove = async (id: string) => {
    const prevExpenses = expenses;
    setExpenses(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('budget_expenses').delete().eq('id', id);
    if (error) {
      setExpenses(prevExpenses);
      throw error;
    }
  };

  return { expenses, loading, add, update, remove, refetch: fetch };
}
