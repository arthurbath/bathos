import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withDrawersDbTiming } from '@/modules/drawers/lib/dbTiming';
import type { DrawersUnit, DrawersUnitFrameColor } from '@/modules/drawers/types/drawers';

interface UnitDraft {
  name: string;
  width: number;
  height: number;
  frame_color: DrawersUnitFrameColor;
}

export function useDrawersUnits(householdId: string) {
  const [units, setUnits] = useState<DrawersUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const unitsRef = useRef<DrawersUnit[]>([]);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

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

    const { data, error } = await withDrawersDbTiming('drawers_units.fetch', async () => (
      supabase
        .from('drawers_units')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true })
    ));

    if (error) throw error;

    setUnits((data as DrawersUnit[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void fetch().catch(() => setLoading(false));
  }, [fetch]);

  const add = useCallback(
    async ({ name, width, height, frame_color }: UnitDraft) => {
      return runQueuedMutation('drawers_units.add', async () => {
        const current = unitsRef.current;
        const nextSortOrder = (current[current.length - 1]?.sort_order ?? -1) + 1;
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        const optimistic: DrawersUnit = {
          id,
          household_id: householdId,
          name,
          width,
          height,
          frame_color,
          sort_order: nextSortOrder,
          created_at: nowIso,
          updated_at: nowIso,
        };

        setUnits(prev => [...prev, optimistic]);

        const { error } = await supabase
          .from('drawers_units')
          .insert({
            id,
            household_id: householdId,
            name,
            width,
            height,
            frame_color,
            sort_order: nextSortOrder,
          });

        if (error) {
          setUnits(prev => prev.filter(unit => unit.id !== id));
          throw error;
        }
      });
    },
    [householdId, runQueuedMutation],
  );

  const rename = useCallback(async (id: string, name: string) => {
    return runQueuedMutation('drawers_units.rename', async () => {
      const previous = unitsRef.current;
      const updatedAt = new Date().toISOString();
      setUnits(prev => prev.map(unit => (unit.id === id ? { ...unit, name, updated_at: updatedAt } : unit)));

      const { error } = await supabase.from('drawers_units').update({ name, updated_at: updatedAt }).eq('id', id);
      if (error) {
        setUnits(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const resize = useCallback(async (id: string, width: number, height: number) => {
    return runQueuedMutation('drawers_units.resize', async () => {
      const previous = unitsRef.current;
      const updatedAt = new Date().toISOString();
      setUnits(prev => prev.map(unit => (unit.id === id ? { ...unit, width, height, updated_at: updatedAt } : unit)));

      const { error } = await supabase.rpc('resize_drawers_unit', {
        _unit_id: id,
        _new_w: width,
        _new_h: height,
      });

      if (error) {
        setUnits(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const setFrameColor = useCallback(async (id: string, frameColor: DrawersUnitFrameColor) => {
    return runQueuedMutation('drawers_units.set_frame_color', async () => {
      const previous = unitsRef.current;
      const updatedAt = new Date().toISOString();
      setUnits(prev => prev.map(unit => (unit.id === id ? { ...unit, frame_color: frameColor, updated_at: updatedAt } : unit)));

      const { error } = await supabase
        .from('drawers_units')
        .update({ frame_color: frameColor, updated_at: updatedAt })
        .eq('id', id);

      if (error) {
        setUnits(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const reorder = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      return runQueuedMutation('drawers_units.reorder', async () => {
        const previous = unitsRef.current;
        const idx = previous.findIndex(unit => unit.id === id);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= previous.length) return;

        const source = previous[idx];
        const target = previous[targetIdx];
        const updatedAt = new Date().toISOString();
        const optimistic = [...previous];
        optimistic[idx] = { ...target, sort_order: source.sort_order, updated_at: updatedAt };
        optimistic[targetIdx] = { ...source, sort_order: target.sort_order, updated_at: updatedAt };
        optimistic.sort((a, b) => a.sort_order - b.sort_order);
        setUnits(optimistic);

        const sourceSort = source.sort_order;
        const targetSort = target.sort_order;

        const [{ error: sourceError }, { error: targetError }] = await Promise.all([
          supabase.from('drawers_units').update({ sort_order: targetSort, updated_at: updatedAt }).eq('id', source.id),
          supabase.from('drawers_units').update({ sort_order: sourceSort, updated_at: updatedAt }).eq('id', target.id),
        ]);

        if (sourceError || targetError) {
          setUnits(previous);
          throw sourceError || targetError;
        }
      });
    },
    [runQueuedMutation],
  );

  const remove = useCallback(async (id: string) => {
    return runQueuedMutation('drawers_units.remove', async () => {
      const previous = unitsRef.current;
      setUnits(prev => prev.filter(unit => unit.id !== id));

      const { error } = await supabase.from('drawers_units').delete().eq('id', id);
      if (error) {
        setUnits(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const hasUnits = useMemo(() => units.length > 0, [units.length]);

  return {
    units,
    loading,
    hasUnits,
    add,
    rename,
    resize,
    setFrameColor,
    reorder,
    remove,
    refetch: fetch,
  };
}
