import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { retryOnLikelyNetworkError, showMutationError } from '@/lib/networkErrors';
import { withDrawersDbTiming } from '@/modules/drawers/lib/dbTiming';
import type { DrawerInstance, DrawerType } from '@/modules/drawers/types/drawers';

function toDrawersArray(data: unknown): DrawerInstance[] {
  return (data as DrawerInstance[]) ?? [];
}

interface AddDrawerTarget {
  unitId: string;
  cubbyX: number;
  cubbyY: number;
}

const CREATE_DRAWER_PENDING_KEY = '__create_drawer__';

function isMissingRpcFunctionError(error: unknown, functionName: string): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { code?: unknown; message?: unknown };
  const code = typeof maybeError.code === 'string' ? maybeError.code : '';
  const message = typeof maybeError.message === 'string' ? maybeError.message : '';

  return (
    code === 'PGRST202' ||
    message.includes(`Could not find the function public.${functionName}`) ||
    message.includes(`Could not find the function ${functionName}`)
  );
}

function nextLimboOrder(drawers: DrawerInstance[]): number {
  return drawers.reduce((max, insert) => {
    if (insert.location_kind !== 'limbo') return max;
    return Math.max(max, insert.limbo_order ?? 0);
  }, 0) + 1;
}

function compareByCreatedAtAndId(a: DrawerInstance, b: DrawerInstance): number {
  const aCreatedAt = a.created_at ?? '';
  const bCreatedAt = b.created_at ?? '';
  if (aCreatedAt !== bCreatedAt) return aCreatedAt.localeCompare(bCreatedAt);
  return a.id.localeCompare(b.id);
}

function applyMoveToLimboState(drawers: DrawerInstance[], drawerId: string): DrawerInstance[] {
  const target = drawers.find(insert => insert.id === drawerId);
  if (!target || target.location_kind === 'limbo') return drawers;

  const newLimboOrder = nextLimboOrder(drawers);
  const nowIso = new Date().toISOString();

  return drawers.map(insert => {
    if (insert.id !== drawerId) return insert;
    return {
      ...insert,
      location_kind: 'limbo',
      unit_id: null,
      cubby_x: null,
      cubby_y: null,
      limbo_order: newLimboOrder,
      updated_at: nowIso,
    };
  });
}

function applyMoveToCubbyState(
  drawers: DrawerInstance[],
  drawerId: string,
  unitId: string,
  cubbyX: number,
  cubbyY: number,
): DrawerInstance[] {
  const source = drawers.find(insert => insert.id === drawerId);
  if (!source) return drawers;

  if (
    source.location_kind === 'cubby' &&
    source.unit_id === unitId &&
    source.cubby_x === cubbyX &&
    source.cubby_y === cubbyY
  ) {
    return drawers;
  }

  const target = drawers.find(insert =>
    insert.id !== drawerId &&
    insert.location_kind === 'cubby' &&
    insert.unit_id === unitId &&
    insert.cubby_x === cubbyX &&
    insert.cubby_y === cubbyY,
  );

  const nowIso = new Date().toISOString();
  const moveTargetToLimboOrder = target ? nextLimboOrder(drawers) : null;

  return drawers.map(insert => {
    if (insert.id === drawerId) {
      return {
        ...insert,
        location_kind: 'cubby',
        unit_id: unitId,
        cubby_x: cubbyX,
        cubby_y: cubbyY,
        limbo_order: null,
        updated_at: nowIso,
      };
    }

    if (!target || insert.id !== target.id) return insert;

    return {
      ...insert,
      location_kind: 'limbo',
      unit_id: null,
      cubby_x: null,
      cubby_y: null,
      limbo_order: moveTargetToLimboOrder,
      updated_at: nowIso,
    };
  });
}

function applyMoveUnitDrawersToLimboState(drawers: DrawerInstance[], unitId: string): DrawerInstance[] {
  const displaced = drawers
    .filter(insert => insert.unit_id === unitId && insert.location_kind === 'cubby')
    .sort(compareByCreatedAtAndId);

  if (displaced.length === 0) return drawers;

  const firstLimboOrder = nextLimboOrder(drawers);
  const limboOrderById = new Map<string, number>();
  displaced.forEach((insert, idx) => limboOrderById.set(insert.id, firstLimboOrder + idx));
  const nowIso = new Date().toISOString();

  return drawers.map(insert => {
    const limboOrder = limboOrderById.get(insert.id);
    if (limboOrder === undefined) return insert;

    return {
      ...insert,
      location_kind: 'limbo',
      unit_id: null,
      cubby_x: null,
      cubby_y: null,
      limbo_order: limboOrder,
      updated_at: nowIso,
    };
  });
}

export function useDrawerInstances(householdId: string) {
  const [drawers, setDrawers] = useState<DrawerInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const drawersRef = useRef<DrawerInstance[]>([]);
  const structuralQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    drawersRef.current = drawers;
  }, [drawers]);

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

  const runStructuralMutation = useCallback(function <T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const execute = () => withDrawersDbTiming(operation, run);
    const resultPromise = structuralQueueRef.current.then(execute, execute);
    structuralQueueRef.current = resultPromise.then(
      () => undefined,
      () => undefined,
    );
    return resultPromise;
  }, []);

  const runDirectMutation = useCallback(function <T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    return withDrawersDbTiming(operation, run);
  }, []);

  const rpcWithFallback = useCallback(async (
    fn: string,
    args: Record<string, unknown>,
    fallback?: { fn: string; args: Record<string, unknown> },
  ) => {
    const primary = await retryOnLikelyNetworkError(async () => await supabase.rpc(fn, args));
    if (!primary.error) return primary;
    if (!fallback || !isMissingRpcFunctionError(primary.error, fn)) return primary;
    return await retryOnLikelyNetworkError(async () => await supabase.rpc(fallback.fn, fallback.args));
  }, []);

  const fetch = useCallback(async () => {
    if (!householdId) {
      setDrawers([]);
      setLoading(false);
      return;
    }

    const { data, error } = await withDrawersDbTiming('drawers_instances.fetch', async () =>
      await retryOnLikelyNetworkError(async () =>
        await supabase
          .from('drawers_instances')
          .select('*')
          .eq('household_id', householdId)
          .order('location_kind', { ascending: true })
          .order('limbo_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true }),
      ),
    );

    if (error) throw error;

    setDrawers(toDrawersArray(data));
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void fetch().catch(() => setLoading(false));
  }, [fetch]);

  const add = useCallback(
    async (drawerType: DrawerType, label: string | null, target?: AddDrawerTarget) => {
      setPending([CREATE_DRAWER_PENDING_KEY], true);
      try {
        return await runStructuralMutation('drawers_instances.add', async () => {
          const id = crypto.randomUUID();
          const normalizedLabel = label?.trim() || null;
          const nextOrder = target ? null : nextLimboOrder(drawersRef.current);

          const { data, error } = await retryOnLikelyNetworkError(async () =>
            await supabase
              .from('drawers_instances')
              .insert({
                id,
                household_id: householdId,
                drawer_type: drawerType,
                label: normalizedLabel,
                location_kind: target ? 'cubby' : 'limbo',
                unit_id: target?.unitId ?? null,
                cubby_x: target?.cubbyX ?? null,
                cubby_y: target?.cubbyY ?? null,
                limbo_order: nextOrder,
              })
              .select('*')
              .single(),
          );

          if (error) throw error;

          const inserted = (data as DrawerInstance | null) ?? null;
          if (!inserted?.id) {
            throw new Error('Failed to add drawer.');
          }

          setDrawers(prev => [...prev, inserted]);
          return inserted.id;
        });
      } catch (error: unknown) {
        showMutationError(error);
        throw error;
      } finally {
        setPending([CREATE_DRAWER_PENDING_KEY], false);
      }
    },
    [householdId, runStructuralMutation, setPending],
  );

  const update = useCallback(async (id: string, updates: Partial<Pick<DrawerInstance, 'label' | 'drawer_type'>>) => {
    setPending([id], true);
    try {
      await runDirectMutation('drawers_instances.update', async () => {
        const nextUpdates: {
          updated_at: string;
          label?: string | null;
          drawer_type?: DrawerType;
        } = {
          updated_at: new Date().toISOString(),
        };

        if (updates.label !== undefined) {
          nextUpdates.label = updates.label?.trim() || null;
        }
        if (updates.drawer_type !== undefined) {
          nextUpdates.drawer_type = updates.drawer_type;
        }

        const { data, error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('drawers_instances')
            .update(nextUpdates)
            .eq('id', id)
            .select('*')
            .single(),
        );

        if (error) throw error;

        const saved = (data as DrawerInstance | null) ?? null;
        if (!saved?.id) {
          throw new Error('Failed to update drawer.');
        }

        setDrawers(prev => prev.map(insert => (insert.id === id ? saved : insert)));
      });
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending([id], false);
    }
  }, [runDirectMutation, setPending]);

  const remove = useCallback(async (id: string) => {
    setPending([id], true);
    try {
      await runStructuralMutation('drawers_instances.remove', async () => {
        const { error } = await retryOnLikelyNetworkError(async () =>
          await supabase.from('drawers_instances').delete().eq('id', id),
        );
        if (error) throw error;
        setDrawers(prev => prev.filter(insert => insert.id !== id));
      });
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending([id], false);
    }
  }, [runStructuralMutation, setPending]);

  const moveToCubby = useCallback(async (
    drawerId: string,
    unitId: string,
    cubbyX: number,
    cubbyY: number,
    existingDrawerId?: string | null,
  ) => {
    const pendingIds = [drawerId];
    if (existingDrawerId && existingDrawerId !== drawerId) {
      pendingIds.push(existingDrawerId);
    }

    setPending(pendingIds, true);
    try {
      await runStructuralMutation('drawers_instances.move_to_cubby', async () => {
        const { error } = await rpcWithFallback(
          'move_drawers_drawer',
          {
            _drawer_id: drawerId,
            _target_unit_id: unitId,
            _target_x: cubbyX,
            _target_y: cubbyY,
          },
          {
            fn: 'move_drawers_insert',
            args: {
              _insert_id: drawerId,
              _target_unit_id: unitId,
              _target_x: cubbyX,
              _target_y: cubbyY,
            },
          },
        );

        if (error) throw error;

        setDrawers(prev => applyMoveToCubbyState(prev, drawerId, unitId, cubbyX, cubbyY));
      });
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(pendingIds, false);
    }
  }, [rpcWithFallback, runStructuralMutation, setPending]);

  const moveToLimbo = useCallback(async (drawerId: string) => {
    setPending([drawerId], true);
    try {
      await runStructuralMutation('drawers_instances.move_to_limbo', async () => {
        const { error } = await rpcWithFallback(
          'move_drawers_drawer_to_limbo',
          {
            _drawer_id: drawerId,
          },
          {
            fn: 'move_drawers_insert_to_limbo',
            args: {
              _insert_id: drawerId,
            },
          },
        );

        if (error) throw error;

        setDrawers(prev => applyMoveToLimboState(prev, drawerId));
      });
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending([drawerId], false);
    }
  }, [rpcWithFallback, runStructuralMutation, setPending]);

  const deleteDrawersInUnit = useCallback(async (unitId: string) => {
    const affectedIds = drawersRef.current
      .filter(insert => insert.unit_id === unitId && insert.location_kind === 'cubby')
      .map(insert => insert.id);

    setPending(affectedIds, true);
    try {
      await runStructuralMutation('drawers_instances.delete_in_unit', async () => {
        const { error } = await retryOnLikelyNetworkError(async () =>
          await supabase
            .from('drawers_instances')
            .delete()
            .eq('household_id', householdId)
            .eq('unit_id', unitId)
            .eq('location_kind', 'cubby'),
        );

        if (error) throw error;

        setDrawers(prev => prev.filter(insert => !(insert.unit_id === unitId && insert.location_kind === 'cubby')));
      });
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(affectedIds, false);
    }
  }, [householdId, runStructuralMutation, setPending]);

  const moveDrawersInUnitToLimbo = useCallback(async (unitId: string) => {
    const affectedIds = drawersRef.current
      .filter(insert => insert.unit_id === unitId && insert.location_kind === 'cubby')
      .map(insert => insert.id);

    setPending(affectedIds, true);
    try {
      await runStructuralMutation('drawers_instances.move_unit_to_limbo', async () => {
        const { error } = await rpcWithFallback(
          'move_drawers_unit_drawers_to_limbo',
          { _unit_id: unitId },
          { fn: 'move_drawers_unit_inserts_to_limbo', args: { _unit_id: unitId } },
        );
        if (error) throw error;
        setDrawers(prev => applyMoveUnitDrawersToLimboState(prev, unitId));
      });
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPending(affectedIds, false);
    }
  }, [rpcWithFallback, runStructuralMutation, setPending]);

  const limboDrawers = useMemo(
    () => drawers.filter(insert => insert.location_kind === 'limbo').sort((a, b) => (a.limbo_order ?? 0) - (b.limbo_order ?? 0)),
    [drawers],
  );
  const creating = !!pendingById[CREATE_DRAWER_PENDING_KEY];

  return {
    drawers,
    limboDrawers,
    loading,
    pendingById,
    creating,
    add,
    update,
    remove,
    moveToCubby,
    moveToLimbo,
    deleteDrawersInUnit,
    moveDrawersInUnitToLimbo,
    refetch: fetch,
  };
}
