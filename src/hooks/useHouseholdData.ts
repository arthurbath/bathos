import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

const DEFAULT_PARTNER_X_NAME = 'Partner A';
const DEFAULT_PARTNER_Y_NAME = 'Partner B';

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
  const userId = user?.id ?? null;

  const getProfileDisplayName = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated');

    const { data: profile, error } = await supabase
      .from('bathos_profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    if (error) throw new Error(`Profile lookup failed: ${error.message}`);

    const displayName = profile?.display_name?.trim();
    if (!displayName) {
      throw new Error('Please set your display name in Account before creating or joining a household.');
    }

    return displayName;
  }, [userId]);

  const fetchHousehold = useCallback(async () => {
    if (!userId) { setHousehold(null); setLoading(false); return; }
    setLoading(true);

    try {
      const { data: membership } = await supabase
        .from('budget_household_members')
        .select('household_id, partner_label')
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) { setLoading(false); return; }

      const [{ data: hh }, { data: profile }] = await Promise.all([
        supabase
          .from('budget_households')
          .select('id, name, invite_code, partner_x_name, partner_y_name, partner_x_color, partner_y_color')
          .eq('id', membership.household_id)
          .single(),
        supabase
          .from('bathos_profiles')
          .select('display_name')
          .eq('id', userId)
          .single(),
      ]);

      if (!hh) { setLoading(false); return; }

      setHousehold({
        householdId: hh.id,
        householdName: hh.name,
        inviteCode: (hh as any).invite_code ?? null,
        partnerX: (hh as any).partner_x_name ?? DEFAULT_PARTNER_X_NAME,
        partnerY: (hh as any).partner_y_name ?? DEFAULT_PARTNER_Y_NAME,
        partnerXColor: (hh as any).partner_x_color ?? null,
        partnerYColor: (hh as any).partner_y_color ?? null,
        displayName: profile?.display_name ?? 'You',
      });
    } catch (err) {
      console.error('Failed to fetch household data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchHousehold(); }, [fetchHousehold]);

  const createHousehold = async () => {
    if (!userId) throw new Error('Not authenticated');
    const displayName = await getProfileDisplayName();

    const householdId = crypto.randomUUID();
    const { error: hhErr } = await supabase
      .from('budget_households')
      .insert({ id: householdId, name: 'My Household', partner_x_name: displayName, partner_y_name: DEFAULT_PARTNER_Y_NAME });
    if (hhErr) throw new Error(`Household creation failed: ${hhErr.message}`);

    const { error: memberErr } = await supabase.from('budget_household_members').insert({
      household_id: householdId,
      user_id: userId,
      partner_label: 'X',
    });
    if (memberErr) throw new Error(`Member insert failed: ${memberErr.message}`);

    await fetchHousehold();
  };

  const joinHousehold = async (inviteCode: string) => {
    if (!userId) throw new Error('Not authenticated');
    const displayName = await getProfileDisplayName();

    const { data: householdId, error: findErr } = await supabase
      .rpc('lookup_household_by_invite_code', { _code: inviteCode });

    if (findErr) throw new Error(`Lookup failed: ${findErr.message}`);
    if (!householdId) throw new Error('Invalid invite code. Please check and try again.');

    const { data: existing } = await supabase
      .from('budget_household_members')
      .select('id')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) throw new Error('You are already a member of this household.');

    const { error: memberErr } = await supabase.from('budget_household_members').insert({
      household_id: householdId,
      user_id: userId,
      partner_label: 'Y',
    });
    if (memberErr) throw new Error(`Join failed: ${memberErr.message}`);

    const { error: renameErr } = await supabase
      .from('budget_households')
      .update({ partner_y_name: displayName })
      .eq('id', householdId)
      .in('partner_y_name', [DEFAULT_PARTNER_Y_NAME, 'Partner Y']);
    if (renameErr) throw new Error(`Partner name update failed: ${renameErr.message}`);

    await fetchHousehold();
  };

  const updatePartnerNames = async (partnerXName: string, partnerYName: string) => {
    if (!household) throw new Error('No household');
    const { error } = await supabase
      .from('budget_households')
      .update({ partner_x_name: partnerXName, partner_y_name: partnerYName })
      .eq('id', household.householdId);
    if (error) throw new Error(error.message);
    await fetchHousehold();
  };

  const updatePartnerColors = async (partnerXColor: string | null, partnerYColor: string | null) => {
    if (!household) throw new Error('No household');
    const { error } = await supabase
      .from('budget_households')
      .update({ partner_x_color: partnerXColor, partner_y_color: partnerYColor })
      .eq('id', household.householdId);
    if (error) throw new Error(error.message);
    await fetchHousehold();
  };

  return { household, loading, createHousehold, joinHousehold, updatePartnerNames, updatePartnerColors, refetch: fetchHousehold };
}
