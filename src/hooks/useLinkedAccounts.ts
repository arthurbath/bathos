import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LinkedAccount {
  id: string;
  name: string;
  color: string | null;
  owner_partner: string;
  household_id: string;
}

export function useLinkedAccounts(householdId: string) {
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('linked_accounts')
      .select('*')
      .eq('household_id', householdId)
      .order('name');
    setLinkedAccounts((data as LinkedAccount[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string, ownerPartner: string = 'X') => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('linked_accounts').insert({ id, household_id: householdId, name, owner_partner: ownerPartner });
    if (error) throw error;
    await fetch();
  };

  const update = async (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => {
    const { error } = await supabase.from('linked_accounts').update(updates).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const updateColor = async (id: string, color: string | null) => {
    const { error } = await supabase.from('linked_accounts').update({ color }).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('linked_accounts').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { linkedAccounts, loading, add, update, updateColor, remove, refetch: fetch };
}
