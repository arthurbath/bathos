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

const CREATE_PENDING_KEY = '__create_insert__';

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
    insert.cubby_y === cubbyY,
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
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const insertsRef = useRef<DrawerInsertInstance[]>([]);
  const structuralQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    insertsRef.current = inserts;
  }, [inserts]);

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
      setPending([CREATE_PENDING_KEY], true);
      try {
        return await runStructuralMutation('drawers_insert_instances.add', async () => {
          const id = crypto.randomUUID();
          const normalizedLabel = label?.trim() || null;
          const nextOrder = target ? null : nextLimboOrder(insertsRef.current);

          const { data, error } = await supabase
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
            })
            .select('*')
            .single();

          if (error) throw error;

          const inserted = (data as DrawerInsertInstance | null) ?? null;
          if (!inserted?.id) {
            throw new Error('Failed to add insert.');
          }

          setInserts(prev => [...prev, inserted]);
          return inserted.id;
        });
      } finally {
        setPending([CREATE_PENDING_KEY], false);
      }
    },
    [householdId, runStructuralMutation, setPending],
  );

  const update = useCallback(async (id: string, updates: Partial<Pick<DrawerInsertInstance, 'label' | 'insert_type'>>) => {
    setPending([id], true);
    try {
      await runDirectMutation('drawers_insert_instances.update', async () => {
        const nextUpdates: {
          updated_at: string;
          label?: string | null;
          insert_type?: DrawerInsertType;
        } = {
          updated_at: new Date().toISOString(),
        };

        if (updates.label !== undefined) {
          nextUpdates.label = updates.label?.trim() || null;
        }
        if (updates.insert_type !== undefined) {
          nextUpdates.insert_type = updates.insert_type;
        }

        const { data, error } = await supabase
          .from('drawers_insert_instances')
          .update(nextUpdates)
          .eq('id', id)
          .select('*')
          .single();

        if (error) throw error;

        const saved = (data as DrawerInsertInstance | null) ?? null;
        if (!saved?.id) {
          throw new Error('Failed to update insert.');
        }

        setInserts(prev => prev.map(insert => (insert.id === id ? saved : insert)));
      });
    } finally {
      setPending([id], false);
    }
  }, [runDirectMutation, setPending]);

  const remove = useCallback(async (id: string) => {
    setPending([id], true);
    try {
      await runStructuralMutation('drawers_insert_instances.remove', async () => {
        const { error } = await supabase.from('drawers_insert_instances').delete().eq('id', id);
        if (error) throw error;
        setInserts(prev => prev.filter(insert => insert.id !== id));
      });
    } finally {
      setPending([id], false);
    }
  }, [runStructuralMutation, setPending]);

  const moveToCubby = useCallback(async (
    insertId: string,
    unitId: string,
    cubbyX: number,
    cubbyY: number,
    existingInsertId?: string | null,
  ) => {
    const pendingIds = [insertId];
    if (existingInsertId && existingInsertId !== insertId) {
      pendingIds.push(existingInsertId);
    }

    setPending(pendingIds, true);
    try {
      await runStructuralMutation('drawers_insert_instances.move_to_cubby', async () => {
        const { error } = await supabase.rpc('move_drawers_insert', {
          _insert_id: insertId,
          _target_unit_id: unitId,
          _target_x: cubbyX,
          _target_y: cubbyY,
        });

        if (error) throw error;

        setInserts(prev => applyMoveToCubbyState(prev, insertId, unitId, cubbyX, cubbyY));
      });
    } finally {
      setPending(pendingIds, false);
    }
  }, [runStructuralMutation, setPending]);

  const moveToLimbo = useCallback(async (insertId: string) => {
    setPending([insertId], true);
    try {
      await runStructuralMutation('drawers_insert_instances.move_to_limbo', async () => {
        const { error } = await supabase.rpc('move_drawers_insert_to_limbo', {
          _insert_id: insertId,
        });

        if (error) throw error;

        setInserts(prev => applyMoveToLimboState(prev, insertId));
      });
    } finally {
      setPending([insertId], false);
    }
  }, [runStructuralMutation, setPending]);

  const deleteInsertsInUnit = useCallback(async (unitId: string) => {
    const affectedIds = insertsRef.current
      .filter(insert => insert.unit_id === unitId && insert.location_kind === 'cubby')
      .map(insert => insert.id);

    setPending(affectedIds, true);
    try {
      await runStructuralMutation('drawers_insert_instances.delete_in_unit', async () => {
        const { error } = await supabase
          .from('drawers_insert_instances')
          .delete()
          .eq('household_id', householdId)
          .eq('unit_id', unitId)
          .eq('location_kind', 'cubby');

        if (error) throw error;

        setInserts(prev => prev.filter(insert => !(insert.unit_id === unitId && insert.location_kind === 'cubby')));
      });
    } finally {
      setPending(affectedIds, false);
    }
  }, [householdId, runStructuralMutation, setPending]);

  const moveInsertsInUnitToLimbo = useCallback(async (unitId: string) => {
    const affectedIds = insertsRef.current
      .filter(insert => insert.unit_id === unitId && insert.location_kind === 'cubby')
      .map(insert => insert.id);

    setPending(affectedIds, true);
    try {
      await runStructuralMutation('drawers_insert_instances.move_unit_to_limbo', async () => {
        const { error } = await supabase.rpc('move_drawers_unit_inserts_to_limbo', { _unit_id: unitId });
        if (error) throw error;
        setInserts(prev => applyMoveUnitInsertsToLimboState(prev, unitId));
      });
    } finally {
      setPending(affectedIds, false);
    }
  }, [runStructuralMutation, setPending]);

  const limboInserts = useMemo(
    () => inserts.filter(insert => insert.location_kind === 'limbo').sort((a, b) => (a.limbo_order ?? 0) - (b.limbo_order ?? 0)),
    [inserts],
  );
  const creating = !!pendingById[CREATE_PENDING_KEY];

  return {
    inserts,
    limboInserts,
    loading,
    pendingById,
    creating,
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
