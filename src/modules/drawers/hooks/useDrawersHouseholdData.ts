import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { DrawersHouseholdData } from '@/modules/drawers/types/drawers';

interface UseDrawersHouseholdDataResult {
  household: DrawersHouseholdData | null;
  loading: boolean;
  displayName: string;
  createHousehold: () => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  refetch: () => Promise<void>;
}

function normalizeInviteCode(code: string): string {
  return code.trim().toLowerCase();
}

export function useDrawersHouseholdData(user: User | null, enabled: boolean): UseDrawersHouseholdDataResult {
  const [household, setHousehold] = useState<DrawersHouseholdData | null>(null);
  const [displayName, setDisplayName] = useState('You');
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  const getProfileDisplayName = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bathos_profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    if (error) throw new Error(`Profile lookup failed: ${error.message}`);

    const name = data?.display_name?.trim();
    if (!name) {
      throw new Error('Please set your display name in Account before creating or joining a drawer household.');
    }

    return name;
  }, [userId]);

  const fetchHousehold = useCallback(async () => {
    if (!userId || !enabled) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
        supabase.from('bathos_profiles').select('display_name').eq('id', userId).single(),
        supabase
          .from('drawers_household_members')
          .select('household_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1),
      ]);

      if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
      if (membershipError) throw new Error(`Membership lookup failed: ${membershipError.message}`);

      const nextDisplayName = profile?.display_name?.trim() || user.email || 'You';
      setDisplayName(nextDisplayName);

      const membership = memberships?.[0];
      if (!membership) {
        setHousehold(null);
        return;
      }

      const { data: hh, error: householdError } = await supabase
        .from('drawers_households')
        .select('id, name, invite_code')
        .eq('id', membership.household_id)
        .single();

      if (householdError) throw new Error(`Household lookup failed: ${householdError.message}`);
      if (!hh) {
        setHousehold(null);
        return;
      }

      setHousehold({
        householdId: hh.id,
        householdName: hh.name,
        inviteCode: hh.invite_code,
        displayName: nextDisplayName,
      });
    } catch (error) {
      console.error('Failed to fetch drawers household data', error);
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.email, userId]);

  useEffect(() => {
    void fetchHousehold();
  }, [fetchHousehold]);

  const createHousehold = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated');

    const profileDisplayName = await getProfileDisplayName();
    const householdId = crypto.randomUUID();
    const { error: createError } = await supabase
      .from('drawers_households')
      .insert({ id: householdId });

    if (createError) {
      throw new Error(createError?.message || 'Failed to create drawer household.');
    }

    const { error: memberError } = await supabase.from('drawers_household_members').insert({
      household_id: householdId,
      user_id: userId,
    });

    if (memberError) throw new Error(`Failed to join created household: ${memberError.message}`);

    setDisplayName(profileDisplayName);
    await fetchHousehold();
  }, [fetchHousehold, getProfileDisplayName, userId]);

  const joinHousehold = useCallback(
    async (inviteCode: string) => {
      if (!userId) throw new Error('Not authenticated');

      const normalizedCode = normalizeInviteCode(inviteCode);
      if (!normalizedCode) throw new Error('Invite code is required.');

      await getProfileDisplayName();

      const { data: householdId, error: lookupError } = await supabase.rpc('lookup_drawers_household_by_invite_code', {
        _code: normalizedCode,
      });

      if (lookupError) throw new Error(`Lookup failed: ${lookupError.message}`);
      if (!householdId) throw new Error('Invalid invite code.');

      const { data: existingMembership, error: existingError } = await supabase
        .from('drawers_household_members')
        .select('id')
        .eq('household_id', householdId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingError) throw new Error(`Membership check failed: ${existingError.message}`);
      if (existingMembership) throw new Error('You are already a member of this drawer household.');

      const { error: joinError } = await supabase.from('drawers_household_members').insert({
        household_id: householdId,
        user_id: userId,
      });

      if (joinError) throw new Error(`Join failed: ${joinError.message}`);

      await fetchHousehold();
    },
    [fetchHousehold, getProfileDisplayName, userId],
  );

  return {
    household,
    loading,
    displayName,
    createHousehold,
    joinHousehold,
    refetch: fetchHousehold,
  };
}
