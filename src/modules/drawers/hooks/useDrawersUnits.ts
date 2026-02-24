import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { retryOnLikelyNetworkError, showMutationError } from '@/lib/networkErrors';
import { withDrawersDbTiming } from '@/modules/drawers/lib/dbTiming';
import type { DrawersUnit, DrawersUnitFrameColor } from '@/modules/drawers/types/drawers';

interface UnitDraft {
  name: string;
  width: number;
  height: number;
  frame_color: DrawersUnitFrameColor;
}

interface SaveUnitDraft extends UnitDraft {
  id?: string | null;
}

const CREATE_PENDING_KEY = '__create_unit__';

function upsertUnit(units: DrawersUnit[], saved: DrawersUnit): DrawersUnit[] {
  const index = units.findIndex(unit => unit.id === saved.id);
  if (index === -1) {
    return [...units, saved].sort((a, b) => a.sort_order - b.sort_order);
  }

  const next = [...units];
  next[index] = saved;
  next.sort((a, b) => a.sort_order - b.sort_order);
  return next;
}

export function useDrawersUnits(householdId: string) {
  const [units, setUnits] = useState<DrawersUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const unitsRef = useRef<DrawersUnit[]>([]);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  const setPending = useCallback((keys: string[], pending: boolean) => {
    if (keys.length === 0) return;
    setPendingById((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        if (!key) continue;
        if (pending) {
          next[key] = true;
        } else {
          delete next[key];
        }
      }
      return next;
    });
  }, []);

  const runQueuedMutation = useCallback(function <T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const execute = () => withDrawersDbTiming(operation, run);
    const resultPromise = mutationQueueRef.current.then(execute, execute);
    mutationQueueRef.current = resultPromise.then(
      () => undefined,
      () => undefined,
    );
    return resultPromise;
  }, []);

  const fetch = useCallback(async () => {
    if (!householdId) {
      setUnits([]);
      setLoading(false);
      return;
    }

    const { data, error } = await withDrawersDbTiming('drawers_units.fetch', async () =>
      await retryOnLikelyNetworkError(async () =>
        await supabase
          .from('drawers_units')
          .select('*')
          .eq('household_id', householdId)
          .order('sort_order', { ascending: true }),
      ),
    );

    if (error) throw error;

    setUnits((data as DrawersUnit[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void fetch().catch(() => setLoading(false));
  }, [fetch]);

  const persistUnit = useCallback(
    async (draft: SaveUnitDraft): Promise<DrawersUnit> => {
      if (!householdId) throw new Error('Missing household id.');

      const pendingKey = draft.id ?? CREATE_PENDING_KEY;
      setPending([pendingKey], true);

      try {
        const { data, error } = await retryOnLikelyNetworkError(async () =>
          await supabase.rpc('drawers_save_unit', {
            _unit_id: draft.id ?? null,
            _household_id: householdId,
            _name: draft.name,
            _width: draft.width,
            _height: draft.height,
            _frame_color: draft.frame_color,
          }),
        );

        if (error) throw error;

        const saved = (data as unknown as DrawersUnit | null) ?? null;
        if (!saved?.id) {
          throw new Error('Failed to save unit.');
        }

        setUnits((prev) => upsertUnit(prev, saved));
        return saved;
      } finally {
        setPending([pendingKey], false);
      }
    },
    [householdId, setPending],
  );

  const save = useCallback(
    async (draft: SaveUnitDraft): Promise<void> => {
      try {
        if (!draft.id) {
          await runQueuedMutation('drawers_units.save', async () => {
            await persistUnit(draft);
          });
          return;
        }

        await withDrawersDbTiming('drawers_units.save', async () => {
          await persistUnit(draft);
        });
      } catch (error: unknown) {
        showMutationError(error);
        throw error;
      }
    },
    [persistUnit, runQueuedMutation],
  );

  const add = useCallback(
    async ({ name, width, height, frame_color }: UnitDraft) => {
      await save({
        name,
        width,
        height,
        frame_color,
      });
    },
    [save],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const existing = unitsRef.current.find((unit) => unit.id === id);
      if (!existing) throw new Error('Unit not found');

      await save({
        id,
        name,
        width: existing.width,
        height: existing.height,
        frame_color: existing.frame_color ?? 'white',
      });
    },
    [save],
  );

  const resize = useCallback(
    async (id: string, width: number, height: number) => {
      const existing = unitsRef.current.find((unit) => unit.id === id);
      if (!existing) throw new Error('Unit not found');

      await save({
        id,
        name: existing.name,
        width,
        height,
        frame_color: existing.frame_color ?? 'white',
      });
    },
    [save],
  );

  const setFrameColor = useCallback(
    async (id: string, frameColor: DrawersUnitFrameColor) => {
      const existing = unitsRef.current.find((unit) => unit.id === id);
      if (!existing) throw new Error('Unit not found');

      await save({
        id,
        name: existing.name,
        width: existing.width,
        height: existing.height,
        frame_color: frameColor,
      });
    },
    [save],
  );

  const reorder = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      setPending([id], true);
      try {
        await runQueuedMutation('drawers_units.reorder', async () => {
          const current = unitsRef.current;
          const idx = current.findIndex(unit => unit.id === id);
          if (idx === -1) return;

          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= current.length) return;

          const source = current[idx];
          const target = current[targetIdx];
          const updatedAt = new Date().toISOString();
          const sourceSort = source.sort_order;
          const targetSort = target.sort_order;

          const [{ error: sourceError }, { error: targetError }] = await Promise.all([
            retryOnLikelyNetworkError(async () =>
              await supabase.from('drawers_units').update({ sort_order: targetSort, updated_at: updatedAt }).eq('id', source.id),
            ),
            retryOnLikelyNetworkError(async () =>
              await supabase.from('drawers_units').update({ sort_order: sourceSort, updated_at: updatedAt }).eq('id', target.id),
            ),
          ]);

          if (sourceError || targetError) {
            throw sourceError || targetError;
          }

          const next = [...current];
          next[idx] = { ...target, sort_order: sourceSort, updated_at: updatedAt };
          next[targetIdx] = { ...source, sort_order: targetSort, updated_at: updatedAt };
          next.sort((a, b) => a.sort_order - b.sort_order);
          setUnits(next);
        });
      } catch (error: unknown) {
        showMutationError(error);
        throw error;
      } finally {
        setPending([id], false);
      }
    },
    [runQueuedMutation, setPending],
  );

  const remove = useCallback(
    async (id: string) => {
      setPending([id], true);
      try {
        await runQueuedMutation('drawers_units.remove', async () => {
          const { error } = await retryOnLikelyNetworkError(async () =>
            await supabase.from('drawers_units').delete().eq('id', id),
          );
          if (error) throw error;
          setUnits(prev => prev.filter(unit => unit.id !== id));
        });
      } catch (error: unknown) {
        showMutationError(error);
        throw error;
      } finally {
        setPending([id], false);
      }
    },
    [runQueuedMutation, setPending],
  );

  const hasUnits = useMemo(() => units.length > 0, [units.length]);
  const creating = !!pendingById[CREATE_PENDING_KEY];

  return {
    units,
    loading,
    hasUnits,
    pendingById,
    creating,
    add,
    save,
    rename,
    resize,
    setFrameColor,
    reorder,
    remove,
    refetch: fetch,
  };
}
