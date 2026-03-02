import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import { withMutationTiming } from '@/lib/mutationTiming';
import { budgetQueryKeys } from '@/hooks/budgetQueryKeys';
import { budgetHouseholdAdapter, useHouseholdManagement } from '@/platform/households';

const DEFAULT_PARTNER_X_NAME = 'Partner A';
const DEFAULT_PARTNER_Y_NAME = 'Partner B';

export interface HouseholdData {
  householdId: string;
  householdName: string;
  inviteCode: string | null;
  partnerX: string;
  partnerY: string;
  wageGapAdjustmentEnabled: boolean;
  partnerXWageCentsPerDollar: number | null;
  partnerYWageCentsPerDollar: number | null;
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
    wageGapAdjustmentEnabled: row.wageGapAdjustmentEnabled === true,
    partnerXWageCentsPerDollar: typeof row.partnerXWageCentsPerDollar === 'number' ? row.partnerXWageCentsPerDollar : null,
    partnerYWageCentsPerDollar: typeof row.partnerYWageCentsPerDollar === 'number' ? row.partnerYWageCentsPerDollar : null,
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
      const membership = await supabaseRequest(async () =>
        await supabase
          .from('budget_household_members')
          .select('household_id')
          .eq('user_id', userId)
          .maybeSingle(),
      );

      if (!membership) return null;

      const household = await supabaseRequest(async () =>
        await supabase
          .from('budget_households')
          .select('id, name, invite_code, partner_x_name, partner_y_name, wage_gap_adjustment_enabled, partner_x_wage_cents_per_dollar, partner_y_wage_cents_per_dollar')
          .eq('id', membership.household_id)
          .single(),
      );

      if (!household) return null;

      return {
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.invite_code ?? null,
        partnerX: household.partner_x_name ?? DEFAULT_PARTNER_X_NAME,
        partnerY: household.partner_y_name ?? DEFAULT_PARTNER_Y_NAME,
        wageGapAdjustmentEnabled: household.wage_gap_adjustment_enabled ?? false,
        partnerXWageCentsPerDollar: household.partner_x_wage_cents_per_dollar ?? null,
        partnerYWageCentsPerDollar: household.partner_y_wage_cents_per_dollar ?? null,
        displayName: '',
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

  const householdManagement = useHouseholdManagement({
    adapter: budgetHouseholdAdapter,
    householdId: household?.householdId ?? null,
    userId,
    enabled: !!userId,
    onInviteCodeChanged: (inviteCode) => {
      queryClient.setQueryData<HouseholdData | null>(queryKey, (current) => {
        if (!current) return current;
        return { ...current, inviteCode };
      });
    },
    onExitedHousehold: async () => {
      queryClient.setQueryData(queryKey, null);
    },
  });

  const createHousehold = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated');

    try {
      const payload = await withMutationTiming({ module: 'budget', action: 'household.create' }, async () => {
        const data = await supabaseRequest(async () =>
          await supabase.rpc('budget_create_household_for_current_user'),
        );
        return data as Json;
      });

      queryClient.setQueryData(queryKey, toRpcHouseholdData(payload));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const joinHousehold = useCallback(async (inviteCode: string) => {
    if (!userId) throw new Error('Not authenticated');

    try {
      const payload = await withMutationTiming({ module: 'budget', action: 'household.join' }, async () => {
        const data = await supabaseRequest(async () =>
          await supabase.rpc('budget_join_household_for_current_user', {
            _invite_code: inviteCode,
          }),
        );
        return data as Json;
      });

      queryClient.setQueryData(queryKey, toRpcHouseholdData(payload));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const updatePartnerSettings = useCallback(async (input: {
    partnerXName: string;
    partnerYName: string;
    wageGapAdjustmentEnabled: boolean;
    partnerXWageCentsPerDollar: number | null;
    partnerYWageCentsPerDollar: number | null;
  }) => {
    if (!userId) throw new Error('Not authenticated');

    const currentHousehold = queryClient.getQueryData<HouseholdData | null>(queryKey);
    if (!currentHousehold) throw new Error('No household');

    try {
      const payload = await withMutationTiming({ module: 'budget', action: 'household.updatePartnerSettings' }, async () => {
        const data = await supabaseRequest(async () =>
          await supabase.rpc('budget_update_partner_settings', {
            _household_id: currentHousehold.householdId,
            _partner_x_name: input.partnerXName,
            _partner_y_name: input.partnerYName,
            _wage_gap_adjustment_enabled: input.wageGapAdjustmentEnabled,
            _partner_x_wage_cents_per_dollar: input.partnerXWageCentsPerDollar,
            _partner_y_wage_cents_per_dollar: input.partnerYWageCentsPerDollar,
          }),
        );
        return data as Json;
      });

      queryClient.setQueryData(queryKey, toRpcHouseholdData(payload));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    household: household ?? null,
    loading: !!userId && isLoading,
    createHousehold,
    joinHousehold,
    updatePartnerSettings,
    householdMembers: householdManagement.members,
    householdMembersLoading: householdManagement.membersLoading,
    householdMembersError: householdManagement.membersError,
    pendingHouseholdMemberId: householdManagement.pendingMemberId,
    rotatingHouseholdInviteCode: householdManagement.rotatingInviteCode,
    leavingHousehold: householdManagement.leavingHousehold,
    deletingHousehold: householdManagement.deletingHousehold,
    rotateHouseholdInviteCode: householdManagement.rotateInviteCode,
    removeHouseholdMember: householdManagement.removeMember,
    leaveHousehold: householdManagement.leaveHousehold,
    deleteHousehold: householdManagement.deleteHousehold,
    refetch: async () => {
      await Promise.all([refetch(), householdManagement.refetchMembers()]);
    },
  };
}
