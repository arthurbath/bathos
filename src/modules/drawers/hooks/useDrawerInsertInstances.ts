import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withDrawersDbTiming } from '@/modules/drawers/lib/dbTiming';
import type { DrawerInsertInstance, DrawerInsertType } from '@/modules/drawers/types/drawers';

function toInsertArray(data: unknown): DrawerInsertInstance[] {
  return (data as DrawerInsertInstance[]) ?? [];
}

interface AddInsertTarget {
  unitId: string;
  cubbyX: number;
  cubbyY: number;
}

function nextLimboOrder(inserts: DrawerInsertInstance[]): number {
  return inserts.reduce((max, insert) => {
    if (insert.location_kind !== 'limbo') return max;
    return Math.max(max, insert.limbo_order ?? 0);
  }, 0) + 1;
}

function compareByCreatedAtAndId(a: DrawerInsertInstance, b: DrawerInsertInstance): number {
  const aCreatedAt = a.created_at ?? '';
  const bCreatedAt = b.created_at ?? '';
  if (aCreatedAt !== bCreatedAt) return aCreatedAt.localeCompare(bCreatedAt);
  return a.id.localeCompare(b.id);
}

function applyMoveToLimboState(inserts: DrawerInsertInstance[], insertId: string): DrawerInsertInstance[] {
  const target = inserts.find(insert => insert.id === insertId);
  if (!target || target.location_kind === 'limbo') return inserts;

  const newLimboOrder = nextLimboOrder(inserts);
  const nowIso = new Date().toISOString();

  return inserts.map(insert => {
    if (insert.id !== insertId) return insert;
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
  inserts: DrawerInsertInstance[],
  insertId: string,
  unitId: string,
  cubbyX: number,
  cubbyY: number,
): DrawerInsertInstance[] {
  const source = inserts.find(insert => insert.id === insertId);
  if (!source) return inserts;

  if (
    source.location_kind === 'cubby' &&
    source.unit_id === unitId &&
    source.cubby_x === cubbyX &&
    source.cubby_y === cubbyY
  ) {
    return inserts;
  }

  const target = inserts.find(insert =>
    insert.id !== insertId &&
    insert.location_kind === 'cubby' &&
    insert.unit_id === unitId &&
    insert.cubby_x === cubbyX &&
    insert.cubby_y === cubbyY
  );

  const nowIso = new Date().toISOString();
  const moveTargetToLimboOrder = target ? nextLimboOrder(inserts) : null;

  return inserts.map(insert => {
    if (insert.id === insertId) {
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

function applyMoveUnitInsertsToLimboState(inserts: DrawerInsertInstance[], unitId: string): DrawerInsertInstance[] {
  const displaced = inserts
    .filter(insert => insert.unit_id === unitId && insert.location_kind === 'cubby')
    .sort(compareByCreatedAtAndId);

  if (displaced.length === 0) return inserts;

  const firstLimboOrder = nextLimboOrder(inserts);
  const limboOrderById = new Map<string, number>();
  displaced.forEach((insert, idx) => limboOrderById.set(insert.id, firstLimboOrder + idx));
  const nowIso = new Date().toISOString();

  return inserts.map(insert => {
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

export function useDrawerInsertInstances(householdId: string) {
  const [inserts, setInserts] = useState<DrawerInsertInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const insertsRef = useRef<DrawerInsertInstance[]>([]);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    insertsRef.current = inserts;
  }, [inserts]);

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
      setInserts([]);
      setLoading(false);
      return;
    }

    const { data, error } = await withDrawersDbTiming('drawers_insert_instances.fetch', async () => (
      supabase
        .from('drawers_insert_instances')
        .select('*')
        .eq('household_id', householdId)
        .order('location_kind', { ascending: true })
        .order('limbo_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
    ));

    if (error) throw error;

    setInserts(toInsertArray(data));
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void fetch().catch(() => setLoading(false));
  }, [fetch]);

  const add = useCallback(
    async (insertType: DrawerInsertType, label: string | null, target?: AddInsertTarget) => {
      return runQueuedMutation('drawers_insert_instances.add', async () => {
        const id = crypto.randomUUID();
        const normalizedLabel = label?.trim() || null;
        const current = insertsRef.current;
        const nextOrder = target ? null : nextLimboOrder(current);
        const nowIso = new Date().toISOString();

        const optimistic: DrawerInsertInstance = {
          id,
          household_id: householdId,
          insert_type: insertType,
          label: normalizedLabel,
          location_kind: target ? 'cubby' : 'limbo',
          unit_id: target?.unitId ?? null,
          cubby_x: target?.cubbyX ?? null,
          cubby_y: target?.cubbyY ?? null,
          limbo_order: nextOrder,
          created_at: nowIso,
          updated_at: nowIso,
        };

        setInserts(prev => [...prev, optimistic]);

        const { error } = await supabase
          .from('drawers_insert_instances')
          .insert({
            id,
            household_id: householdId,
            insert_type: insertType,
            label: normalizedLabel,
            location_kind: target ? 'cubby' : 'limbo',
            unit_id: target?.unitId ?? null,
            cubby_x: target?.cubbyX ?? null,
            cubby_y: target?.cubbyY ?? null,
            limbo_order: nextOrder,
          });

        if (error) {
          setInserts(prev => prev.filter(insert => insert.id !== id));
          throw error;
        }

        return id;
      });
    },
    [householdId, runQueuedMutation],
  );

  const update = useCallback(async (id: string, updates: Partial<Pick<DrawerInsertInstance, 'label' | 'insert_type'>>) => {
    return runQueuedMutation('drawers_insert_instances.update', async () => {
      const previous = insertsRef.current;
      const nextUpdates = {
        ...updates,
        label: updates.label === undefined ? undefined : updates.label?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      setInserts(prev => prev.map(insert => (insert.id === id ? { ...insert, ...nextUpdates } : insert)));

      const { error } = await supabase.from('drawers_insert_instances').update(nextUpdates).eq('id', id);
      if (error) {
        setInserts(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const remove = useCallback(async (id: string) => {
    return runQueuedMutation('drawers_insert_instances.remove', async () => {
      const previous = insertsRef.current;
      setInserts(prev => prev.filter(insert => insert.id !== id));

      const { error } = await supabase.from('drawers_insert_instances').delete().eq('id', id);
      if (error) {
        setInserts(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const moveToCubby = useCallback(async (
    insertId: string,
    unitId: string,
    cubbyX: number,
    cubbyY: number,
    existingInsertId?: string | null,
  ) => {
    return runQueuedMutation('drawers_insert_instances.move_to_cubby', async () => {
      const previous = insertsRef.current;
      setInserts(prev => applyMoveToCubbyState(prev, insertId, unitId, cubbyX, cubbyY));

      try {
        if (existingInsertId && existingInsertId !== insertId) {
          const { error: moveExistingError } = await supabase.rpc('move_drawers_insert_to_limbo', {
            _insert_id: existingInsertId,
          });

          if (moveExistingError && !moveExistingError.message.includes('Insert instance not found')) {
            throw moveExistingError;
          }
        }

        const { error } = await supabase.rpc('move_drawers_insert', {
          _insert_id: insertId,
          _target_unit_id: unitId,
          _target_x: cubbyX,
          _target_y: cubbyY,
        });

        if (error) throw error;
      } catch (error: unknown) {
        setInserts(previous);
        await fetch().catch(() => undefined);
        throw error;
      }
    });
  }, [fetch, runQueuedMutation]);

  const moveToLimbo = useCallback(async (insertId: string) => {
    return runQueuedMutation('drawers_insert_instances.move_to_limbo', async () => {
      const previous = insertsRef.current;
      setInserts(prev => applyMoveToLimboState(prev, insertId));

      const { error } = await supabase.rpc('move_drawers_insert_to_limbo', {
        _insert_id: insertId,
      });

      if (error) {
        setInserts(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const deleteInsertsInUnit = useCallback(async (unitId: string) => {
    return runQueuedMutation('drawers_insert_instances.delete_in_unit', async () => {
      const previous = insertsRef.current;
      setInserts(prev => prev.filter(insert => !(insert.unit_id === unitId && insert.location_kind === 'cubby')));

      const { error } = await supabase
        .from('drawers_insert_instances')
        .delete()
        .eq('household_id', householdId)
        .eq('unit_id', unitId)
        .eq('location_kind', 'cubby');

      if (error) {
        setInserts(previous);
        throw error;
      }
    });
  }, [householdId, runQueuedMutation]);

  const moveInsertsInUnitToLimbo = useCallback(async (unitId: string) => {
    return runQueuedMutation('drawers_insert_instances.move_unit_to_limbo', async () => {
      const previous = insertsRef.current;
      setInserts(prev => applyMoveUnitInsertsToLimboState(prev, unitId));

      const { error } = await supabase.rpc('move_drawers_unit_inserts_to_limbo', { _unit_id: unitId });
      if (error) {
        setInserts(previous);
        throw error;
      }
    });
  }, [runQueuedMutation]);

  const limboInserts = useMemo(
    () => inserts.filter(insert => insert.location_kind === 'limbo').sort((a, b) => (a.limbo_order ?? 0) - (b.limbo_order ?? 0)),
    [inserts],
  );

  return {
    inserts,
    limboInserts,
    loading,
    add,
    update,
    remove,
    moveToCubby,
    moveToLimbo,
    deleteInsertsInUnit,
    moveInsertsInUnitToLimbo,
    refetch: fetch,
  };
}
