import type { Tables } from '@/integrations/supabase/types';

export type SnakeHousehold = Tables<'snake_households'>;
export type SnakeHouseholdMember = Tables<'snake_household_members'>;
export type Snake = Tables<'snake_snakes'>;
export type SnakeGrowthExpectationRange = Tables<'snake_growth_expectation_ranges'>;
export type SnakeWeightRecord = Tables<'snake_weight_records'>;

export type SnakeSex = 'unknown' | 'female' | 'male';

export interface SnakeHouseholdData {
  householdId: string;
  householdName: string;
  inviteCode: string | null;
}

export interface SnakeInput {
  name: string;
  birthday: string;
  species: string;
  growth_profile: string;
  morph?: string | null;
  sex: SnakeSex;
  notes?: string | null;
  is_active?: boolean;
}

export type SnakeUpdate = Partial<SnakeInput> & {
  sort_order?: number;
};

export interface SnakeWeightRecordInput {
  recorded_on: string;
  weight_grams: number;
}

export type SnakeWeightRecordUpdate = Partial<SnakeWeightRecordInput>;

export interface DerivedSnakeWeightRecord extends SnakeWeightRecord {
  previousRecordDate: string | null;
  previousWeightGrams: number | null;
  daysSincePrevious: number | null;
  changeGrams: number | null;
  changeGramsPerMonth: number | null;
  ageMonths: number | null;
  growthExpectationLowerGramsPerMonth: number | null;
  growthExpectationUpperGramsPerMonth: number | null;
  growthStatus: string | null;
}
