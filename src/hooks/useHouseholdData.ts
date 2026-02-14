import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface HouseholdData {
  householdId: string;
  householdName: string;
  partnerX: string;
  partnerY: string;
  myLabel: 'X' | 'Y';
}

export function useHouseholdData(user: User | null) {
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHousehold = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Get membership
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, partner_label')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) { setLoading(false); return; }

    // Get household info
    const { data: hh } = await supabase
      .from('households')
      .select('id, name')
      .eq('id', membership.household_id)
      .single();

    if (!hh) { setLoading(false); return; }

    // Get all members with profiles
    const { data: members } = await supabase
      .from('household_members')
      .select('partner_label, user_id')
      .eq('household_id', hh.id);

    let partnerX = 'Partner X';
    let partnerY = 'Partner Y';

    if (members) {
      for (const m of members) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', m.user_id)
          .single();
        const name = profile?.display_name ?? 'Partner';
        if (m.partner_label === 'X') partnerX = name;
        else partnerY = name;
      }
    }

    setHousehold({
      householdId: hh.id,
      householdName: hh.name,
      partnerX,
      partnerY,
      myLabel: membership.partner_label as 'X' | 'Y',
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHousehold(); }, [fetchHousehold]);

  const createHousehold = async (displayName: string) => {
    if (!user) throw new Error('Not authenticated');

    // Update profile display name
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);
    if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

    // Generate household ID client-side to avoid needing .select() after insert.
    // PostgREST's RETURNING clause triggers the SELECT RLS policy, which fails
    // because the user isn't yet a household member at insert time.
    const householdId = crypto.randomUUID();

    const { error: hhErr } = await supabase
      .from('households')
      .insert({ id: householdId, name: 'My Household' });
    if (hhErr) throw new Error(`Household creation failed: ${hhErr.message}`);

    // Add self as partner X
    const { error: memberErr } = await supabase.from('household_members').insert({
      household_id: householdId,
      user_id: user.id,
      partner_label: 'X',
    });
    if (memberErr) throw new Error(`Member insert failed: ${memberErr.message}`);

    await fetchHousehold();
  };

  return { household, loading, createHousehold, refetch: fetchHousehold };
}
