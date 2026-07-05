import type { Database } from '@/integrations/supabase/types';

export type HouseholdRpcName = keyof Database['public']['Functions'];

export interface HouseholdMember {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  isSelf: boolean;
}

export interface HouseholdModuleAdapter {
  module: 'budget' | 'drawers' | 'snake';
  rpc: {
    createHousehold: HouseholdRpcName;
    joinHousehold: HouseholdRpcName;
    listMembers: HouseholdRpcName;
    rotateInviteCode: HouseholdRpcName;
    removeMember: HouseholdRpcName;
    leaveHousehold: HouseholdRpcName;
    deleteHousehold: HouseholdRpcName;
  };
}
