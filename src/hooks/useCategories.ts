import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  name: string;
  color: string | null;
  household_id: string;
}

export function useCategories(householdId: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', householdId)
      .order('name');
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('categories').insert({
      id,
      household_id: householdId,
      name,
    });
    if (error) throw error;
    await fetch();
  };

  const update = async (id: string, name: string) => {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const updateColor = async (id: string, color: string | null) => {
    const { error } = await supabase.from('categories').update({ color }).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { categories, loading, add, update, updateColor, remove, refetch: fetch };
}
