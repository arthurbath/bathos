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

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('restore_points')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    setPoints((data as RestorePoint[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (name: string, snapshot: Json) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('restore_points').insert({
      id,
      household_id: householdId,
      name: name || null,
      data: snapshot,
    });
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('restore_points').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { points, loading, save, remove, refetch: fetch };
}
