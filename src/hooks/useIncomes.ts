import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FrequencyType } from '@/types/fairshare';

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  partner_label: string;
  household_id: string;
}

export function useIncomes(householdId: string) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('income_streams')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at');
    setIncomes((data as Income[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (income: Omit<Income, 'id' | 'household_id'>) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('income_streams').insert({
      id,
      household_id: householdId,
      ...income,
    });
    if (error) throw error;
    await fetch();
  };

  const update = async (id: string, updates: Partial<Omit<Income, 'id' | 'household_id'>>) => {
    const { error } = await supabase.from('income_streams').update(updates).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('income_streams').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { incomes, loading, add, update, remove, refetch: fetch };
}
