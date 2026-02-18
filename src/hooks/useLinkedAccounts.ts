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
  const sortByName = (rows: LinkedAccount[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('budget_linked_accounts')
      .select('*')
      .eq('household_id', householdId)
      .order('name');
    setLinkedAccounts((data as LinkedAccount[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string, ownerPartner: string = 'X') => {
    const id = crypto.randomUUID();
    const optimistic: LinkedAccount = { id, household_id: householdId, name, owner_partner: ownerPartner, color: null };
    setLinkedAccounts(prev => sortByName([...prev, optimistic]));

    const { data, error } = await supabase.from('budget_linked_accounts').insert({ id, household_id: householdId, name, owner_partner: ownerPartner }).select('*').single();
    if (error) {
      setLinkedAccounts(prev => prev.filter(a => a.id !== id));
      throw error;
    }
    if (data) {
      setLinkedAccounts(prev => sortByName(prev.map(a => (a.id === id ? (data as LinkedAccount) : a))));
    }
  };

  const update = async (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => {
    const prevAccounts = linkedAccounts;
    setLinkedAccounts(prev => sortByName(prev.map(a => a.id === id ? { ...a, ...updates } : a)));
    const { data, error } = await supabase.from('budget_linked_accounts').update(updates).eq('id', id).select('*').single();
    if (error) {
      setLinkedAccounts(prevAccounts);
      throw error;
    }
    if (data) {
      setLinkedAccounts(prev => sortByName(prev.map(a => (a.id === id ? (data as LinkedAccount) : a))));
    }
  };

  const updateColor = async (id: string, color: string | null) => {
    const prevAccounts = linkedAccounts;
    setLinkedAccounts(prev => sortByName(prev.map(a => a.id === id ? { ...a, color } : a)));
    const { data, error } = await supabase.from('budget_linked_accounts').update({ color }).eq('id', id).select('*').single();
    if (error) {
      setLinkedAccounts(prevAccounts);
      throw error;
    }
    if (data) {
      setLinkedAccounts(prev => sortByName(prev.map(a => (a.id === id ? (data as LinkedAccount) : a))));
    }
  };

  const remove = async (id: string) => {
    const prevAccounts = linkedAccounts;
    setLinkedAccounts(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('budget_linked_accounts').delete().eq('id', id);
    if (error) {
      setLinkedAccounts(prevAccounts);
      throw error;
    }
  };

  return { linkedAccounts, loading, add, update, updateColor, remove, refetch: fetch };
}
