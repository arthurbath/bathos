import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface RestorePoint {
  id: string;
  notes: string | null;
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
    const mapped = ((data as Array<Omit<RestorePoint, 'notes'> & { name: string | null }>) ?? []).map((row) => ({
      id: row.id,
      household_id: row.household_id,
      data: row.data,
      created_at: row.created_at,
      notes: row.name,
    }));
    setPoints(mapped);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (notes: string, snapshot: Json) => {
    const id = crypto.randomUUID();
    const optimistic: RestorePoint = {
      id,
      household_id: householdId,
      notes: notes || null,
      data: snapshot,
      created_at: new Date().toISOString(),
    };
    setPoints(prev => sortByCreatedAtDesc([optimistic, ...prev]));

    const { data, error } = await supabase.from('budget_restore_points').insert({
      id,
      household_id: householdId,
      name: notes || null,
      data: snapshot,
    }).select('*').single();
    if (error) {
      setPoints(prev => prev.filter(p => p.id !== id));
      throw error;
    }
    if (data) {
      const row = data as Omit<RestorePoint, 'notes'> & { name: string | null };
      const mapped = {
        id: row.id,
        household_id: row.household_id,
        data: row.data,
        created_at: row.created_at,
        notes: row.name,
      };
      setPoints(prev => sortByCreatedAtDesc(prev.map(p => (p.id === id ? mapped : p))));
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

  const updateNotes = async (id: string, notes: string) => {
    const normalized = notes.trim();
    const prevPoints = points;
    setPoints(prev => prev.map(p => (p.id === id ? { ...p, notes: normalized || null } : p)));
    const { error } = await supabase
      .from('budget_restore_points')
      .update({ name: normalized || null })
      .eq('id', id);
    if (error) {
      setPoints(prevPoints);
      throw error;
    }
  };

  return { points, loading, save, remove, updateNotes, refetch: fetch };
}
