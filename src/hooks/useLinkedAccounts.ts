import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isLikelyNetworkError, toUserFacingErrorMessage } from '@/lib/networkErrors';

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
  const accountsRef = useRef(linkedAccounts);
  accountsRef.current = linkedAccounts;
  const sortByName = (rows: LinkedAccount[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

  const fetch = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('budget_linked_accounts')
        .select('*')
        .eq('household_id', householdId)
        .order('name');
      if (error) throw error;
      setLinkedAccounts((data as LinkedAccount[]) ?? []);
    } catch {
      // Keep previous in-memory data if fetch fails.
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (name: string, ownerPartner: string = 'X') => {
    const id = crypto.randomUUID();
    const optimistic: LinkedAccount = { id, household_id: householdId, name, owner_partner: ownerPartner, color: null };
    setLinkedAccounts(prev => sortByName([...prev, optimistic]));

    try {
      const { data, error } = await supabase
        .from('budget_linked_accounts')
        .insert({ id, household_id: householdId, name, owner_partner: ownerPartner })
        .select('*')
        .single();
      if (error) throw error;
      if (data) {
        setLinkedAccounts(prev => sortByName(prev.map(a => (a.id === id ? (data as LinkedAccount) : a))));
      }
    } catch (e: any) {
      setLinkedAccounts(prev => prev.filter(a => a.id !== id));
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, [householdId]);

  const update = useCallback(async (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => {
    const prevAccounts = accountsRef.current;
    setLinkedAccounts(prev => sortByName(prev.map(a => a.id === id ? { ...a, ...updates } : a)));
    try {
      const { data, error } = await supabase.from('budget_linked_accounts').update(updates).eq('id', id).select('*').single();
      if (error) throw error;
      if (data) {
        setLinkedAccounts(prev => sortByName(prev.map(a => (a.id === id ? (data as LinkedAccount) : a))));
      }
    } catch (e: any) {
      setLinkedAccounts(prevAccounts);
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, []);

  const updateColor = useCallback(async (id: string, color: string | null) => {
    const prevAccounts = accountsRef.current;
    setLinkedAccounts(prev => sortByName(prev.map(a => a.id === id ? { ...a, color } : a)));
    try {
      const { data, error } = await supabase.from('budget_linked_accounts').update({ color }).eq('id', id).select('*').single();
      if (error) throw error;
      if (data) {
        setLinkedAccounts(prev => sortByName(prev.map(a => (a.id === id ? (data as LinkedAccount) : a))));
      }
    } catch (e: any) {
      setLinkedAccounts(prevAccounts);
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const prevAccounts = accountsRef.current;
    setLinkedAccounts(prev => prev.filter(a => a.id !== id));
    try {
      const { error } = await supabase.from('budget_linked_accounts').delete().eq('id', id);
      if (error) throw error;
    } catch (e: any) {
      setLinkedAccounts(prevAccounts);
      if (isLikelyNetworkError(e)) {
        throw new Error(toUserFacingErrorMessage(e));
      }
      throw e;
    }
  }, []);

  return { linkedAccounts, loading, add, update, updateColor, remove, refetch: fetch };
}
