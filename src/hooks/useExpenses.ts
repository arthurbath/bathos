import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';
import { isLikelyNetworkError, retryOnLikelyNetworkError, toUserFacingErrorMessage } from '@/lib/networkErrors';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
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
  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;

  const sortByCreatedAt = (rows: Expense[]) =>
    [...rows].sort((a, b) => {
      const aCreated = (a as unknown as { created_at?: string }).created_at ?? '';
      const bCreated = (b as unknown as { created_at?: string }).created_at ?? '';
      return aCreated.localeCompare(bCreated);
    });

  const fetch = useCallback(async () => {
    try {
      const { data, error } = await retryOnLikelyNetworkError(() =>
        supabase
          .from('budget_expenses')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at'),
      );
      if (error) throw error;
      setExpenses((data as Expense[]) ?? []);
    } catch {
      // Keep previous in-memory data if fetch fails.
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (expense: Omit<Expense, 'id' | 'household_id'>) => {
    const id = crypto.randomUUID();
    const optimistic: Expense = { id, household_id: householdId, ...expense };
    setExpenses(prev => sortByCreatedAt([...prev, optimistic]));

    try {
      const { data, error } = await retryOnLikelyNetworkError(() =>
        supabase.from('budget_expenses').insert({
          id,
          household_id: householdId,
          ...expense,
        }).select('*').single(),
      );
      if (error) throw error;
      if (data) {
        setExpenses(prev => sortByCreatedAt(prev.map(e => (e.id === id ? (data as Expense) : e))));
      }
    } catch (e: any) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, [householdId]);

  const update = useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => {
    const prevExpenses = expensesRef.current;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    try {
      const { data, error } = await retryOnLikelyNetworkError(() =>
        supabase.from('budget_expenses').update(updates).eq('id', id).select('*').single(),
      );
      if (error) throw error;
      if (data) {
        setExpenses(prev => sortByCreatedAt(prev.map(e => (e.id === id ? (data as Expense) : e))));
      }
    } catch (e: any) {
      setExpenses(prevExpenses);
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const prevExpenses = expensesRef.current;
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      const { error } = await retryOnLikelyNetworkError(() =>
        supabase.from('budget_expenses').delete().eq('id', id),
      );
      if (error) throw error;
    } catch (e: any) {
      setExpenses(prevExpenses);
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, []);

  return { expenses, loading, add, update, remove, refetch: fetch };
}
