import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import type { SnakeHouseholdData } from '@/modules/snake/types/snake';
import { snakeHouseholdAdapter, useHouseholdManagement, type HouseholdMember } from '@/platform/households';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import { withMutationTiming } from '@/lib/mutationTiming';

interface UseSnakeHouseholdDataResult {
  household: SnakeHouseholdData | null;
  loading: boolean;
  createHousehold: () => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  householdMembers: HouseholdMember[];
  householdMembersLoading: boolean;
  householdMembersError: string | null;
  pendingHouseholdMemberId: string | null;
  rotatingHouseholdInviteCode: boolean;
  leavingHousehold: boolean;
  deletingHousehold: boolean;
  rotateHouseholdInviteCode: () => Promise<void>;
  removeHouseholdMember: (memberUserId: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  deleteHousehold: () => Promise<void>;
  refetch: () => Promise<void>;
}

function normalizeInviteCode(code: string): string {
  return code.trim().toLowerCase();
}

function toRpcHouseholdData(payload: Json): SnakeHouseholdData {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Unexpected household response shape.');
  }

  const row = payload as Record<string, unknown>;
  const householdId = typeof row.householdId === 'string' ? row.householdId : '';
  if (!householdId) throw new Error('Household response missing householdId.');

  return {
    householdId,
    householdName: typeof row.householdName === 'string' ? row.householdName : 'My Snake Household',
    inviteCode: typeof row.inviteCode === 'string' ? row.inviteCode : null,
  };
}

export function useSnakeHouseholdData(user: User | null, enabled: boolean): UseSnakeHouseholdDataResult {
  const [household, setHousehold] = useState<SnakeHouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  const fetchHousehold = useCallback(async () => {
    if (!userId || !enabled) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const membership = await supabaseRequest(async () =>
        await supabase
          .from('snake_household_members')
          .select('household_id')
          .eq('user_id', userId)
          .maybeSingle(),
      );

      if (!membership?.household_id) {
        setHousehold(null);
        return;
      }

      const hh = await supabaseRequest(async () =>
        await supabase
          .from('snake_households')
          .select('id, name, invite_code')
          .eq('id', membership.household_id)
          .single(),
      );

      if (!hh) {
        setHousehold(null);
        return;
      }

      setHousehold({
        householdId: hh.id,
        householdName: hh.name,
        inviteCode: hh.invite_code,
      });
    } catch (error) {
      console.error('Failed to fetch snake household data', error);
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId]);

  useEffect(() => {
    void fetchHousehold();
  }, [fetchHousehold]);

  const householdManagement = useHouseholdManagement({
    adapter: snakeHouseholdAdapter,
    householdId: household?.householdId ?? null,
    userId,
    enabled: !!userId && enabled,
    onInviteCodeChanged: (inviteCode) => {
      setHousehold((current) => {
        if (!current) return current;
        return { ...current, inviteCode };
      });
    },
    onExitedHousehold: async () => {
      setHousehold(null);
      await fetchHousehold();
    },
  });

  const createHousehold = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated');

    try {
      const payload = await withMutationTiming({ module: 'snake', action: 'household.create' }, async () => {
        const data = await supabaseRequest(async () =>
          await supabase.rpc('snake_create_household_for_current_user'),
        );
        return data as Json;
      });

      setHousehold(toRpcHouseholdData(payload));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  }, [userId]);

  const joinHousehold = useCallback(async (inviteCode: string) => {
    if (!userId) throw new Error('Not authenticated');

    const normalizedCode = normalizeInviteCode(inviteCode);
    if (!normalizedCode) throw new Error('Invite code is required.');

    try {
      const payload = await withMutationTiming({ module: 'snake', action: 'household.join' }, async () => {
        const data = await supabaseRequest(async () =>
          await supabase.rpc('snake_join_household_for_current_user', {
            _invite_code: normalizedCode,
          }),
        );
        return data as Json;
      });

      setHousehold(toRpcHouseholdData(payload));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    }
  }, [userId]);

  return {
    household,
    loading,
    createHousehold,
    joinHousehold,
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
      await Promise.all([fetchHousehold(), householdManagement.refetchMembers()]);
    },
  };
}
