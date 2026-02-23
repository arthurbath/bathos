export type DrawerInsertType = 'black' | 'wicker' | 'blank';
export type DrawersUnitFrameColor = 'black' | 'brown' | 'white';

export interface DrawersHouseholdMembership {
  household_id: string;
}

export interface DrawersHouseholdData {
  householdId: string;
  householdName: string;
  inviteCode: string;
  displayName: string;
}

export interface DrawersUnit {
  id: string;
  household_id: string;
  name: string;
  width: number;
  height: number;
  frame_color: DrawersUnitFrameColor;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DrawerInsertInstance {
  id: string;
  household_id: string;
  insert_type: DrawerInsertType;
  label: string | null;
  location_kind: 'limbo' | 'cubby';
  unit_id: string | null;
  cubby_x: number | null;
  cubby_y: number | null;
  limbo_order: number | null;
  created_at?: string;
  updated_at?: string;
}
