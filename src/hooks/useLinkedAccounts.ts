import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLikelyNetworkError, retryOnLikelyNetworkError, toUserFacingErrorMessage } from '@/lib/networkErrors';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';

export interface LinkedAccount {
  id: string;
  name: string;
  color: string | null;
  owner_partner: string;
  household_id: string;
}

function sortByName(rows: LinkedAccount[]): LinkedAccount[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function useLinkedAccounts(householdId: string) {
  const queryClient = useQueryClient();
  const queryKey = budgetQueryKeys.linkedAccounts(householdId);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: Boolean(householdId),
    queryFn: async () => {
      const { data: rows, error } = await retryOnLikelyNetworkError(async () =>
        await supabase
          .from('budget_linked_accounts')
          .select('*')
          .eq('household_id', householdId)
          .order('name'),
      );

      if (error) throw error;
      return (rows as LinkedAccount[]) ?? [];
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

  const add = useCallback(async (
    name: string,
    ownerPartner: string = 'X',
    color: string | null = null,
    id: string = crypto.randomUUID(),
  ) => {
    if (!householdId) throw new Error('No household selected.');

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'linkedAccounts.add' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_linked_accounts')
            .insert({
              id,
              household_id: householdId,
              name,
              owner_partner: ownerPartner,
              color,
            })
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as LinkedAccount;
      });

      queryClient.setQueryData<LinkedAccount[]>(queryKey, (current) => sortByName([...(current ?? []), saved]));
    } catch (error: unknown) {
      if (isLikelyNetworkError(error)) {
        throw new Error(toUserFacingErrorMessage(error));
      }
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [householdId, queryClient, queryKey, setPending]);

  const update = useCallback(async (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'linkedAccounts.update' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_linked_accounts')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as LinkedAccount;
      });

      queryClient.setQueryData<LinkedAccount[]>(queryKey, (current) =>
        sortByName((current ?? []).map((account) => (account.id === id ? saved : account))),
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

  const updateColor = useCallback(async (id: string, color: string | null) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      const saved = await withMutationTiming({ module: 'budget', action: 'linkedAccounts.updateColor' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_linked_accounts')
            .update({ color })
            .eq('id', id)
            .select('*')
            .single(),
        );

        if (error) throw error;
        return row as LinkedAccount;
      });

      queryClient.setQueryData<LinkedAccount[]>(queryKey, (current) =>
        sortByName((current ?? []).map((account) => (account.id === id ? saved : account))),
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
      await withMutationTiming({ module: 'budget', action: 'linkedAccounts.remove' }, async () => {
        const { error } = await retryOnLikelyNetworkError(async () =>
          await supabase.from('budget_linked_accounts').delete().eq('id', id),
        );

        if (error) throw error;
      });

      queryClient.setQueryData<LinkedAccount[]>(queryKey, (current) =>
        (current ?? []).filter((account) => account.id !== id),
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

  return {
    linkedAccounts: data ?? [],
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
