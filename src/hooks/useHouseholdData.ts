import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';

const DEFAULT_PARTNER_X_NAME = 'Partner A';
const DEFAULT_PARTNER_Y_NAME = 'Partner B';

export interface HouseholdData {
  householdId: string;
  householdName: string;
  inviteCode: string | null;
  partnerX: string;
  partnerY: string;
  displayName: string;
}

function toRpcHouseholdData(payload: Json): HouseholdData {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Unexpected household response shape.');
  }

  const row = payload as Record<string, unknown>;
  const householdId = typeof row.householdId === 'string' ? row.householdId : '';
  if (!householdId) throw new Error('Household response missing householdId.');

  return {
    householdId,
    householdName: typeof row.householdName === 'string' ? row.householdName : 'My Household',
    inviteCode: typeof row.inviteCode === 'string' ? row.inviteCode : null,
    partnerX: typeof row.partnerX === 'string' ? row.partnerX : DEFAULT_PARTNER_X_NAME,
    partnerY: typeof row.partnerY === 'string' ? row.partnerY : DEFAULT_PARTNER_Y_NAME,
    displayName: typeof row.displayName === 'string' ? row.displayName : 'You',
  };
}

export function useHouseholdData(user: User | null) {
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = budgetQueryKeys.household(userId);

  const fetchHousehold = useCallback(async (): Promise<HouseholdData | null> => {
    if (!userId) return null;

    try {
      const { data: membership, error: membershipError } = await supabase
        .from('budget_household_members')
        .select('household_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) return null;

      const [{ data: household, error: householdError }, { data: profile, error: profileError }] = await Promise.all([
        supabase
          .from('budget_households')
          .select('id, name, invite_code, partner_x_name, partner_y_name')
          .eq('id', membership.household_id)
          .single(),
        supabase
          .from('bathos_profiles')
          .select('display_name')
          .eq('id', userId)
          .single(),
      ]);

      if (householdError) throw householdError;
      if (profileError) throw profileError;
      if (!household) return null;

      return {
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.invite_code ?? null,
        partnerX: household.partner_x_name ?? DEFAULT_PARTNER_X_NAME,
        partnerY: household.partner_y_name ?? DEFAULT_PARTNER_Y_NAME,
        displayName: profile?.display_name ?? 'You',
      };
    } catch (error) {
      console.error('Failed to fetch household data:', error);
      return null;
    }
  }, [userId]);

  const { data: household, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: fetchHousehold,
  });

  const createHousehold = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated');

    const payload = await withMutationTiming({ module: 'budget', action: 'household.create' }, async () => {
      const { data, error } = await supabase.rpc('budget_create_household_for_current_user');
      if (error) throw new Error(error.message);
      return data as Json;
    });

    queryClient.setQueryData(queryKey, toRpcHouseholdData(payload));
  }, [queryClient, queryKey, userId]);

  const joinHousehold = useCallback(async (inviteCode: string) => {
    if (!userId) throw new Error('Not authenticated');

    const payload = await withMutationTiming({ module: 'budget', action: 'household.join' }, async () => {
      const { data, error } = await supabase.rpc('budget_join_household_for_current_user', {
        _invite_code: inviteCode,
      });

      if (error) throw new Error(error.message);
      return data as Json;
    });

    queryClient.setQueryData(queryKey, toRpcHouseholdData(payload));
  }, [queryClient, queryKey, userId]);

  const updatePartnerNames = useCallback(async (partnerXName: string, partnerYName: string) => {
    if (!userId) throw new Error('Not authenticated');

    const currentHousehold = queryClient.getQueryData<HouseholdData | null>(queryKey);
    if (!currentHousehold) throw new Error('No household');

    const payload = await withMutationTiming({ module: 'budget', action: 'household.updatePartnerNames' }, async () => {
      const { data, error } = await supabase.rpc('budget_update_partner_names', {
        _household_id: currentHousehold.householdId,
        _partner_x_name: partnerXName,
        _partner_y_name: partnerYName,
      });

      if (error) throw new Error(error.message);
      return data as Json;
    });

    queryClient.setQueryData(queryKey, toRpcHouseholdData(payload));
  }, [queryClient, queryKey, userId]);

  return {
    household: household ?? null,
    loading: !!userId && isLoading,
    createHousehold,
    joinHousehold,
    updatePartnerNames,
    refetch: async () => {
      await refetch();
    },
  };
}
