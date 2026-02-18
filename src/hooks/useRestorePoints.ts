import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface RestorePoint {
  id: string;
  name: string | null;
  data: Json;
  household_id: string;
  created_at: string;
}

export function useRestorePoints(householdId: string) {
  const [points, setPoints] = useState<RestorePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const sortByCreatedAtDesc = (rows: RestorePoint[]) =>
    [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('budget_restore_points')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    setPoints((data as RestorePoint[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (name: string, snapshot: Json) => {
    const id = crypto.randomUUID();
    const optimistic: RestorePoint = {
      id,
      household_id: householdId,
      name: name || null,
      data: snapshot,
      created_at: new Date().toISOString(),
    };
    setPoints(prev => sortByCreatedAtDesc([optimistic, ...prev]));

    const { data, error } = await supabase.from('budget_restore_points').insert({
      id,
      household_id: householdId,
      name: name || null,
      data: snapshot,
    }).select('*').single();
    if (error) {
      setPoints(prev => prev.filter(p => p.id !== id));
      throw error;
    }
    if (data) {
      setPoints(prev => sortByCreatedAtDesc(prev.map(p => (p.id === id ? (data as RestorePoint) : p))));
    }
  };

  const remove = async (id: string) => {
    const prevPoints = points;
    setPoints(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('budget_restore_points').delete().eq('id', id);
    if (error) {
      setPoints(prevPoints);
      throw error;
    }
  };

  return { points, loading, save, remove, refetch: fetch };
}
