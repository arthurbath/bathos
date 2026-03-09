import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withMutationTiming } from '@/lib/mutationTiming';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import type { HouseholdMember, HouseholdModuleAdapter } from '@/platform/households/types';

interface UseHouseholdManagementOptions {
  adapter: HouseholdModuleAdapter;
  householdId: string | null;
  userId: string | null;
  onInviteCodeChanged?: (inviteCode: string | null) => void;
  onExitedHousehold?: () => Promise<void> | void;
  enabled?: boolean;
}

interface UseHouseholdManagementResult {
  members: HouseholdMember[];
  membersLoading: boolean;
  membersError: string | null;
  pendingMemberId: string | null;
  rotatingInviteCode: boolean;
  leavingHousehold: boolean;
  deletingHousehold: boolean;
  refetchMembers: () => Promise<void>;
  rotateInviteCode: () => Promise<void>;
  removeMember: (memberUserId: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  deleteHousehold: () => Promise<void>;
}

type SupabaseRpcName = Parameters<typeof supabase.rpc>[0];
type SupabaseRpcArgs = NonNullable<Parameters<typeof supabase.rpc>[1]>;

function callRpc(functionName: string, args: Record<string, unknown>) {
  return supabase.rpc(functionName as SupabaseRpcName, args as SupabaseRpcArgs);
}

function toMember(row: unknown): HouseholdMember {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Unexpected member payload.');
  }

  const record = row as Record<string, unknown>;
  const userId = typeof record.user_id === 'string' ? record.user_id : '';
  if (!userId) {
    throw new Error('Member payload missing user id.');
  }

  return {
    userId,
    email: typeof record.email === 'string' ? record.email : null,
    displayName: typeof record.display_name === 'string' ? record.display_name : null,
    createdAt: typeof record.created_at === 'string' ? record.created_at : '',
    isSelf: record.is_self === true,
  };
}

function extractInviteCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const row = payload as Record<string, unknown>;
  if (typeof row.inviteCode === 'string') return row.inviteCode;
  if (typeof row.invite_code === 'string') return row.invite_code;
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === 'object') {
    const record = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    const details = typeof record.details === 'string' ? record.details.trim() : '';
    const hint = typeof record.hint === 'string' ? record.hint.trim() : '';
    const code = typeof record.code === 'string' ? record.code.trim() : '';

    const segments = [
      message,
      details,
      hint ? `Hint: ${hint}` : '',
      code ? `Code: ${code}` : '',
    ].filter((segment) => segment.length > 0);

    if (segments.length > 0) return segments.join(' | ');
  }

  return fallback;
}

export function useHouseholdManagement({
  adapter,
  householdId,
  userId,
  onInviteCodeChanged,
  onExitedHousehold,
  enabled = true,
}: UseHouseholdManagementOptions): UseHouseholdManagementResult {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [rotatingInviteCode, setRotatingInviteCode] = useState(false);
  const [leavingHousehold, setLeavingHousehold] = useState(false);
  const [deletingHousehold, setDeletingHousehold] = useState(false);

  const refetchMembers = useCallback(async () => {
    if (!enabled || !householdId || !userId) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError(null);
      return;
    }

    setMembersLoading(true);
    try {
      const rows = await supabaseRequest(async () =>
        await callRpc(adapter.rpc.listMembers, {
          _household_id: householdId,
        }),
      );

      const nextMembers = Array.isArray(rows) ? (rows as unknown[]).map(toMember) : [];
      setMembers(nextMembers);
      setMembersError(null);
    } catch (error) {
      console.error('Failed to fetch household members', error);
      setMembers([]);
      setMembersError(getErrorMessage(error, 'Failed to load household members.'));
    } finally {
      setMembersLoading(false);
    }
  }, [adapter.rpc.listMembers, enabled, householdId, userId]);

  useEffect(() => {
    void refetchMembers();
  }, [refetchMembers]);

  const rotateInviteCode = useCallback(async () => {
    if (!enabled || !householdId || !userId) {
      throw new Error('No household selected.');
    }

    setRotatingInviteCode(true);
    try {
      const payload = await withMutationTiming({ module: adapter.module, action: 'household.rotateInviteCode' }, async () => {
        const data = await supabaseRequest(async () =>
          await callRpc(adapter.rpc.rotateInviteCode, {
            _household_id: householdId,
          }),
        );
        return data;
      });

      onInviteCodeChanged?.(extractInviteCode(payload));
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setRotatingInviteCode(false);
    }
  }, [adapter.module, adapter.rpc.rotateInviteCode, enabled, householdId, onInviteCodeChanged, userId]);

  const removeMember = useCallback(async (memberUserId: string) => {
    if (!enabled || !householdId || !userId) {
      throw new Error('No household selected.');
    }

    setPendingMemberId(memberUserId);
    try {
      const payload = await withMutationTiming({ module: adapter.module, action: 'household.removeMember' }, async () => {
        const data = await supabaseRequest(async () =>
          await callRpc(adapter.rpc.removeMember, {
            _household_id: householdId,
            _member_user_id: memberUserId,
          }),
        );
        return data;
      });

      onInviteCodeChanged?.(extractInviteCode(payload));
      await refetchMembers();
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setPendingMemberId(null);
    }
  }, [adapter.module, adapter.rpc.removeMember, enabled, householdId, onInviteCodeChanged, refetchMembers, userId]);

  const leaveHousehold = useCallback(async () => {
    if (!enabled || !householdId || !userId) {
      throw new Error('No household selected.');
    }

    setLeavingHousehold(true);
    try {
      await withMutationTiming({ module: adapter.module, action: 'household.leave' }, async () => {
        await supabaseRequest(async () =>
          await callRpc(adapter.rpc.leaveHousehold, {
            _household_id: householdId,
          }),
        );
      });

      setMembers([]);
      await onExitedHousehold?.();
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setLeavingHousehold(false);
    }
  }, [adapter.module, adapter.rpc.leaveHousehold, enabled, householdId, onExitedHousehold, userId]);

  const deleteHousehold = useCallback(async () => {
    if (!enabled || !householdId || !userId) {
      throw new Error('No household selected.');
    }

    setDeletingHousehold(true);
    try {
      await withMutationTiming({ module: adapter.module, action: 'household.delete' }, async () => {
        await supabaseRequest(async () =>
          await callRpc(adapter.rpc.deleteHousehold, {
            _household_id: householdId,
          }),
        );
      });

      setMembers([]);
      await onExitedHousehold?.();
    } catch (error: unknown) {
      showMutationError(error);
      throw error;
    } finally {
      setDeletingHousehold(false);
    }
  }, [adapter.module, adapter.rpc.deleteHousehold, enabled, householdId, onExitedHousehold, userId]);

  return {
    members,
    membersLoading,
    membersError,
    pendingMemberId,
    rotatingInviteCode,
    leavingHousehold,
    deletingHousehold,
    refetchMembers,
    rotateInviteCode,
    removeMember,
    leaveHousehold,
    deleteHousehold,
  };
}
