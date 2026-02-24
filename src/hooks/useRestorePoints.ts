import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { retryOnLikelyNetworkError, showMutationError } from '@/lib/networkErrors';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';

export interface RestorePoint {
  id: string;
  notes: string | null;
  data: Json;
  household_id: string;
  created_at: string;
}

type RestorePointRow = Omit<RestorePoint, 'notes'> & { notes: string | null };

function sortByCreatedAtDesc(rows: RestorePoint[]): RestorePoint[] {
  return [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

function mapRow(row: RestorePointRow): RestorePoint {
  return {
    id: row.id,
    household_id: row.household_id,
    data: row.data,
    created_at: row.created_at,
    notes: row.notes,
  };
}

export function useRestorePoints(householdId: string) {
  const queryClient = useQueryClient();
  const queryKey = budgetQueryKeys.restorePoints(householdId);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: Boolean(householdId),
    queryFn: async () => {
      const { data: rows, error } = await retryOnLikelyNetworkError(async () =>
        await supabase
          .from('budget_restore_points')
          .select('id, household_id, data, created_at, notes')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false }),
      );

      if (error) throw error;
      const mapped = ((rows as RestorePointRow[]) ?? []).map(mapRow);
      return sortByCreatedAtDesc(mapped);
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

  const save = useCallback(async (notes: string, snapshot: Json) => {
    if (!householdId) throw new Error('No household selected.');

    const normalized = notes.trim();
    const id = crypto.randomUUID();
    setPending(id, true);
    try {
      const row = await withMutationTiming({ module: 'budget', action: 'restorePoints.save' }, async () => {
        const { data: savedRow, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_restore_points')
            .insert({
              id,
              household_id: householdId,
              notes: normalized || null,
              data: snapshot,
            })
            .select('id, household_id, data, created_at, notes')
            .single(),
        );
        if (error) throw error;
        return savedRow as RestorePointRow;
      });

      queryClient.setQueryData<RestorePoint[]>(queryKey, (current) => sortByCreatedAtDesc([mapRow(row), ...(current ?? [])]));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [householdId, queryClient, queryKey, setPending]);

  const remove = useCallback(async (id: string) => {
    if (pendingById[id]) return;

    setPending(id, true);
    try {
      await withMutationTiming({ module: 'budget', action: 'restorePoints.remove' }, async () => {
        const { error } = await retryOnLikelyNetworkError(async () =>
          await supabase.from('budget_restore_points').delete().eq('id', id),
        );
        if (error) throw error;
      });

      queryClient.setQueryData<RestorePoint[]>(queryKey, (current) => (current ?? []).filter((point) => point.id !== id));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [pendingById, queryClient, queryKey, setPending]);

  const updateNotes = useCallback(async (id: string, notes: string) => {
    if (pendingById[id]) return;
    if (!householdId) throw new Error('No household selected.');

    const normalized = notes.trim();
    setPending(id, true);
    try {
      const updatedRow = await withMutationTiming({ module: 'budget', action: 'restorePoints.updateNotes' }, async () => {
        const { data: row, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('budget_restore_points')
            .update({ notes: normalized || null })
            .eq('id', id)
            .eq('household_id', householdId)
            .select('id, household_id, data, created_at, notes')
            .single(),
        );

        if (error) throw error;
        return row as RestorePointRow;
      });

      queryClient.setQueryData<RestorePoint[]>(queryKey, (current) =>
        (current ?? []).map((point) => (point.id === id ? mapRow(updatedRow) : point)),
      );
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(id, false);
    }
  }, [householdId, pendingById, queryClient, queryKey, setPending]);

  return {
    points: data ?? [],
    loading: isLoading,
    save,
    remove,
    updateNotes,
    pendingById,
    refetch: async () => {
      await refetch();
    },
  };
}
