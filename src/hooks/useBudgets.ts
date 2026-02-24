import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { retryOnLikelyNetworkError, showMutationError } from '@/lib/networkErrors';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';

export interface Budget {
  id: string;
  name: string;
  color: string | null;
  household_id: string;
}

function sortByName(rows: Budget[]): Budget[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function useBudgets(householdId: string) {
  const queryClient = useQueryClient();
  const queryKey = budgetQueryKeys.budgets(householdId);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: Boolean(householdId),
    queryFn: async () => {
      const { data: rows, error } = await retryOnLikelyNetworkError(async () =>
        await supabase
          .from('budget_budgets')
          .select('*')
          .eq('household_id', householdId)
          .order('name'),
      );

      if (error) throw error;
      return (rows as Budget[]) ?? [];
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

  const add = useCallback(async (name: string) => {
    if (!householdId) throw new Error('No household selected.');

    const id = crypto.randomUUID();
    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'budgets.add' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_budgets')
            .insert({ id, household_id: householdId, name })
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as Budget;
      });

      queryClient.setQueryData<Budget[]>(queryKey, (current) => sortByName([...(current ?? []), saved]));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [householdId, queryClient, queryKey, setPending]);

  const update = useCallback(async (id: string, name: string) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'budgets.update' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_budgets')
            .update({ name })
            .eq('id', id)
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as Budget;
      });

      queryClient.setQueryData<Budget[]>(queryKey, (current) =>
        sortByName((current ?? []).map((budget) => (budget.id === id ? saved : budget))),
      );
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  const updateColor = useCallback(async (id: string, color: string | null) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'budgets.updateColor' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_budgets')
            .update({ color })
            .eq('id', id)
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as Budget;
      });

      queryClient.setQueryData<Budget[]>(queryKey, (current) =>
        sortByName((current ?? []).map((budget) => (budget.id === id ? saved : budget))),
      );
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  const remove = useCallback(async (id: string) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      await withMutationTiming({ module: 'budget', action: 'budgets.remove' }, async () => {
        const { error } = await retryOnLikelyNetworkError(async () =>
          await supabase.from('budget_budgets').delete().eq('id', id),
        );
        if (error) throw error;
      });

      queryClient.setQueryData<Budget[]>(queryKey, (current) => (current ?? []).filter((budget) => budget.id !== id));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  return {
    budgets: data ?? [],
    loading: isLoading,
    add,
    update,
    updateColor,
    remove,
    pendingById,
    refetch: async () => {
      await refetch();
    },
  };
}
