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
    if (!user) return;

    // Update profile display name
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id);

    // Create household
    const { data: hh, error: hhErr } = await supabase
      .from('households')
      .insert({ name: 'My Household' })
      .select('id')
      .single();

    if (hhErr || !hh) throw hhErr;

    // Add self as partner X
    await supabase.from('household_members').insert({
      household_id: hh.id,
      user_id: user.id,
      partner_label: 'X',
    });

    await fetchHousehold();
  };

  return { household, loading, createHousehold, refetch: fetchHousehold };
}
