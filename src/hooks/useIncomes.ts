import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  partner_label: string;
  household_id: string;
}

function sortByCreatedAt(rows: Income[]): Income[] {
  return [...rows].sort((a, b) => {
    const aCreated = (a as unknown as { created_at?: string }).created_at ?? '';
    const bCreated = (b as unknown as { created_at?: string }).created_at ?? '';
    return aCreated.localeCompare(bCreated);
  });
}

export function useIncomes(householdId: string) {
  const queryClient = useQueryClient();
  const queryKey = budgetQueryKeys.incomes(householdId);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: Boolean(householdId),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('budget_income_streams')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at');

      if (error) throw error;
      return (rows as Income[]) ?? [];
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

  const add = useCallback(async (income: Omit<Income, 'id' | 'household_id'>) => {
    if (!householdId) throw new Error('No household selected.');

    const id = crypto.randomUUID();
    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'incomes.add' }, async () => {
        const { data: row, error } = await supabase
          .from('budget_income_streams')
          .insert({
            id,
            household_id: householdId,
            ...income,
          })
          .select('*')
          .single();

        if (error) throw error;
        return row as Income;
      });

      queryClient.setQueryData<Income[]>(queryKey, (current) => sortByCreatedAt([...(current ?? []), saved]));
    } finally {
      setPending(id, false);
    }
  }, [householdId, queryClient, queryKey, setPending]);

  const update = useCallback(async (id: string, updates: Partial<Omit<Income, 'id' | 'household_id'>>) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'incomes.update' }, async () => {
        const { data: row, error } = await supabase
          .from('budget_income_streams')
          .update(updates)
          .eq('id', id)
          .select('*')
          .single();

        if (error) throw error;
        return row as Income;
      });

      queryClient.setQueryData<Income[]>(queryKey, (current) =>
        sortByCreatedAt((current ?? []).map((income) => (income.id === id ? saved : income))),
      );
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  const remove = useCallback(async (id: string) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      await withMutationTiming({ module: 'budget', action: 'incomes.remove' }, async () => {
        const { error } = await supabase.from('budget_income_streams').delete().eq('id', id);
        if (error) throw error;
      });

      queryClient.setQueryData<Income[]>(queryKey, (current) => (current ?? []).filter((income) => income.id !== id));
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  return {
    incomes: data ?? [],
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
