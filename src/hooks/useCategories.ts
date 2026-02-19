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
  const sortByName = (rows: Category[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('household_id', householdId)
      .order('name');
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string, color: string | null = null, id: string = crypto.randomUUID()) => {
    const optimistic: Category = { id, household_id: householdId, name, color };
    setCategories(prev => sortByName([...prev, optimistic]));

    const { data, error } = await supabase.from('budget_categories').insert({
      id,
      household_id: householdId,
      name,
      color,
    }).select('*').single();
    if (error) {
      setCategories(prev => prev.filter(c => c.id !== id));
      throw error;
    }
    if (data) {
      setCategories(prev => sortByName(prev.map(c => (c.id === id ? (data as Category) : c))));
    }
  };

  const update = async (id: string, name: string) => {
    const prevCategories = categories;
    setCategories(prev => sortByName(prev.map(c => c.id === id ? { ...c, name } : c)));
    const { data, error } = await supabase.from('budget_categories').update({ name }).eq('id', id).select('*').single();
    if (error) {
      setCategories(prevCategories);
      throw error;
    }
    if (data) {
      setCategories(prev => sortByName(prev.map(c => (c.id === id ? (data as Category) : c))));
    }
  };

  const updateColor = async (id: string, color: string | null) => {
    const prevCategories = categories;
    setCategories(prev => sortByName(prev.map(c => c.id === id ? { ...c, color } : c)));
    const { data, error } = await supabase.from('budget_categories').update({ color }).eq('id', id).select('*').single();
    if (error) {
      setCategories(prevCategories);
      throw error;
    }
    if (data) {
      setCategories(prev => sortByName(prev.map(c => (c.id === id ? (data as Category) : c))));
    }
  };

  const remove = async (id: string) => {
    const prevCategories = categories;
    setCategories(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('budget_categories').delete().eq('id', id);
    if (error) {
      setCategories(prevCategories);
      throw error;
    }
  };

  return { categories, loading, add, update, updateColor, remove, refetch: fetch };
}
