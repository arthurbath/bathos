export interface ExerciseDefinition {
  id: string;
  user_id: string;
  name: string;
  rep_count: number | null;
  duration_seconds: number | null;
  distance_miles: number | null;
  weight_lbs: number | null;
  weight_delta_lbs: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRoutine {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRoutineItem {
  id: string;
  routine_id: string;
  exercise_definition_id: string;
  sort_order: number;
}

export interface ExerciseRoutineWithItems extends ExerciseRoutine {
  items: ExerciseRoutineItem[];
}

export interface ExerciseDefinitionInput {
  name: string;
  rep_count: number | null;
  duration_seconds: number | null;
  distance_miles: number | null;
  weight_lbs: number | null;
  weight_delta_lbs: number | null;
}

export interface ExerciseRoutineInput {
  name: string;
  exercise_definition_ids: string[];
}

export interface ExerciseDefinitionFormState {
  name: string;
  hasReps: boolean;
  repCount: string;
  hasDuration: boolean;
  duration: string;
  hasDistance: boolean;
  distance: string;
  hasWeight: boolean;
  weight: string;
  hasWeightDelta: boolean;
  weightDelta: string;
}
