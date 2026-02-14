import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface HouseholdData {
  householdId: string;
  householdName: string;
  inviteCode: string | null;
  partnerX: string;
  partnerY: string;
  partnerXColor: string | null;
  partnerYColor: string | null;
  displayName: string;
}

export function useHouseholdData(user: User | null) {
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHousehold = useCallback(async () => {
    if (!user) { setHousehold(null); setLoading(false); return; }
    setLoading(true);

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, partner_label')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) { setLoading(false); return; }

    const { data: hh } = await supabase
      .from('households')
      .select('id, name, invite_code, partner_x_name, partner_y_name, partner_x_color, partner_y_color')
      .eq('id', membership.household_id)
      .single();

    if (!hh) { setLoading(false); return; }

    // Get current user's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    setHousehold({
      householdId: hh.id,
      householdName: hh.name,
      inviteCode: (hh as any).invite_code ?? null,
      partnerX: (hh as any).partner_x_name ?? 'Partner X',
      partnerY: (hh as any).partner_y_name ?? 'Partner Y',
      partnerXColor: (hh as any).partner_x_color ?? null,
      partnerYColor: (hh as any).partner_y_color ?? null,
      displayName: profile?.display_name ?? 'You',
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHousehold(); }, [fetchHousehold]);

  const createHousehold = async (displayName: string) => {
    if (!user) throw new Error('Not authenticated');

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);
    if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

    const householdId = crypto.randomUUID();
    const { error: hhErr } = await supabase
      .from('households')
      .insert({ id: householdId, name: 'My Household', partner_x_name: displayName, partner_y_name: 'Partner Y' });
    if (hhErr) throw new Error(`Household creation failed: ${hhErr.message}`);

    const { error: memberErr } = await supabase.from('household_members').insert({
      household_id: householdId,
      user_id: user.id,
      partner_label: 'X',
    });
    if (memberErr) throw new Error(`Member insert failed: ${memberErr.message}`);

    await fetchHousehold();
  };

  const joinHousehold = async (displayName: string, inviteCode: string) => {
    if (!user) throw new Error('Not authenticated');

    // Update display name
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);
    if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

    // Find household by invite code
    const { data: hh, error: findErr } = await supabase
      .from('households')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (findErr) throw new Error(`Lookup failed: ${findErr.message}`);
    if (!hh) throw new Error('Invalid invite code. Please check and try again.');

    // Check if already a member
    const { data: existing } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', hh.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) throw new Error('You are already a member of this household.');

    // Join as a member
    const { error: memberErr } = await supabase.from('household_members').insert({
      household_id: hh.id,
      user_id: user.id,
      partner_label: 'Y',
    });
    if (memberErr) throw new Error(`Join failed: ${memberErr.message}`);

    await fetchHousehold();
  };

  const updatePartnerNames = async (partnerXName: string, partnerYName: string) => {
    if (!household) throw new Error('No household');
    const { error } = await supabase
      .from('households')
      .update({ partner_x_name: partnerXName, partner_y_name: partnerYName })
      .eq('id', household.householdId);
    if (error) throw new Error(error.message);
    await fetchHousehold();
  };

  const updatePartnerColors = async (partnerXColor: string | null, partnerYColor: string | null) => {
    if (!household) throw new Error('No household');
    const { error } = await supabase
      .from('households')
      .update({ partner_x_color: partnerXColor, partner_y_color: partnerYColor })
      .eq('id', household.householdId);
    if (error) throw new Error(error.message);
    await fetchHousehold();
  };

  return { household, loading, createHousehold, joinHousehold, updatePartnerNames, updatePartnerColors, refetch: fetchHousehold };
}
