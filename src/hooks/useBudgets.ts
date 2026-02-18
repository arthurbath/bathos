import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Budget {
  id: string;
  name: string;
  color: string | null;
  household_id: string;
}

export function useBudgets(householdId: string) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const sortByName = (rows: Budget[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('budget_budgets')
      .select('*')
      .eq('household_id', householdId)
      .order('name');
    setBudgets((data as Budget[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string) => {
    const id = crypto.randomUUID();
    const optimistic: Budget = { id, household_id: householdId, name, color: null };
    setBudgets(prev => sortByName([...prev, optimistic]));

    const { data, error } = await supabase.from('budget_budgets').insert({ id, household_id: householdId, name }).select('*').single();
    if (error) {
      setBudgets(prev => prev.filter(b => b.id !== id));
      throw error;
    }
    if (data) {
      setBudgets(prev => sortByName(prev.map(b => (b.id === id ? (data as Budget) : b))));
    }
  };

  const update = async (id: string, name: string) => {
    const prevBudgets = budgets;
    setBudgets(prev => sortByName(prev.map(b => b.id === id ? { ...b, name } : b)));
    const { data, error } = await supabase.from('budget_budgets').update({ name }).eq('id', id).select('*').single();
    if (error) {
      setBudgets(prevBudgets);
      throw error;
    }
    if (data) {
      setBudgets(prev => sortByName(prev.map(b => (b.id === id ? (data as Budget) : b))));
    }
  };

  const updateColor = async (id: string, color: string | null) => {
    const prevBudgets = budgets;
    setBudgets(prev => sortByName(prev.map(b => b.id === id ? { ...b, color } : b)));
    const { data, error } = await supabase.from('budget_budgets').update({ color }).eq('id', id).select('*').single();
    if (error) {
      setBudgets(prevBudgets);
      throw error;
    }
    if (data) {
      setBudgets(prev => sortByName(prev.map(b => (b.id === id ? (data as Budget) : b))));
    }
  };

  const remove = async (id: string) => {
    const prevBudgets = budgets;
    setBudgets(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('budget_budgets').delete().eq('id', id);
    if (error) {
      setBudgets(prevBudgets);
      throw error;
    }
  };

  return { budgets, loading, add, update, updateColor, remove, refetch: fetch };
}
