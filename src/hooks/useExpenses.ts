import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';
import { isLikelyNetworkError, retryOnLikelyNetworkError, toUserFacingErrorMessage } from '@/lib/networkErrors';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';

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

function sortByCreatedAt(rows: Expense[]): Expense[] {
  return [...rows].sort((a, b) => {
    const aCreated = (a as unknown as { created_at?: string }).created_at ?? '';
    const bCreated = (b as unknown as { created_at?: string }).created_at ?? '';
    return aCreated.localeCompare(bCreated);
  });
}

export function useExpenses(householdId: string) {
  const queryClient = useQueryClient();
  const queryKey = budgetQueryKeys.expenses(householdId);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: Boolean(householdId),
    queryFn: async () => {
      const { data: rows, error } = await retryOnLikelyNetworkError(async () =>
        await supabase
          .from('budget_expenses')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at'),
      );

      if (error) throw error;
      return (rows as Expense[]) ?? [];
    },
  });

  const setPending = useCallback((id: string, pending: boolean) => {
    setPendingById((current) => {
      if (pending) return { ...current, [id]: true };
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const add = useCallback(async (expense: Omit<Expense, 'id' | 'household_id'>, id: string = crypto.randomUUID()) => {
    if (!householdId) throw new Error('No household selected.');
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'expenses.add' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_expenses')
            .insert({
              id,
              household_id: householdId,
              ...expense,
            })
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as Expense;
      });

      queryClient.setQueryData<Expense[]>(queryKey, (current) => sortByCreatedAt([...(current ?? []), saved]));
    } catch (error: unknown) {
      if (isLikelyNetworkError(error)) {
        throw new Error(toUserFacingErrorMessage(error));
      }
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [householdId, pendingById, queryClient, queryKey, setPending]);

  const update = useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'expenses.update' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_expenses')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as Expense;
      });

      queryClient.setQueryData<Expense[]>(queryKey, (current) =>
        sortByCreatedAt((current ?? []).map((expense) => (expense.id === id ? saved : expense))),
      );
    } catch (error: unknown) {
      if (isLikelyNetworkError(error)) {
        throw new Error(toUserFacingErrorMessage(error));
      }
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  const remove = useCallback(async (id: string) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      await withMutationTiming({ module: 'budget', action: 'expenses.remove' }, async () => {
        const { error } = await retryOnLikelyNetworkError(async () =>
          await supabase.from('budget_expenses').delete().eq('id', id),
        );

        if (error) throw error;
      });

      queryClient.setQueryData<Expense[]>(queryKey, (current) => (current ?? []).filter((expense) => expense.id !== id));
    } catch (error: unknown) {
      if (isLikelyNetworkError(error)) {
        throw new Error(toUserFacingErrorMessage(error));
      }
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  return {
    expenses: data ?? [],
    loading: isLoading,
    add,
    update,
    remove,
    pendingById,
    refetch: async () => {
      await refetch();
    },
  };
}
