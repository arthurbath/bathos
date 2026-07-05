import type { HouseholdModuleAdapter } from '@/platform/households/types';

export const budgetHouseholdAdapter: HouseholdModuleAdapter = {
  module: 'budget',
  rpc: {
    createHousehold: 'budget_create_household_for_current_user',
    joinHousehold: 'budget_join_household_for_current_user',
    listMembers: 'budget_list_household_members',
    rotateInviteCode: 'budget_rotate_household_invite_code',
    removeMember: 'budget_remove_household_member',
    leaveHousehold: 'budget_leave_household',
    deleteHousehold: 'budget_delete_household',
  },
};

export const drawersHouseholdAdapter: HouseholdModuleAdapter = {
  module: 'drawers',
  rpc: {
    createHousehold: 'drawers_create_household_for_current_user',
    joinHousehold: 'drawers_join_household_for_current_user',
    listMembers: 'drawers_list_household_members',
    rotateInviteCode: 'drawers_rotate_household_invite_code',
    removeMember: 'drawers_remove_household_member',
    leaveHousehold: 'drawers_leave_household',
    deleteHousehold: 'drawers_delete_household',
  },
};

export const snakeHouseholdAdapter: HouseholdModuleAdapter = {
  module: 'snake',
  rpc: {
    createHousehold: 'snake_create_household_for_current_user',
    joinHousehold: 'snake_join_household_for_current_user',
    listMembers: 'snake_list_household_members',
    rotateInviteCode: 'snake_rotate_household_invite_code',
    removeMember: 'snake_remove_household_member',
    leaveHousehold: 'snake_leave_household',
    deleteHousehold: 'snake_delete_household',
  },
};
