import { describe, expect, it } from 'vitest';
import {
  createExerciseDefinitionFormState,
  moveRoutineExercise,
  normalizeExerciseDefinitionFormState,
  summarizeExerciseDefinition,
} from '@/modules/exercise/lib/exercise';
import type { ExerciseDefinition } from '@/modules/exercise/types/exercise';

function buildDefinition(overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id: 'exercise-1',
    user_id: 'user-1',
    name: 'Plank',
    rep_count: null,
    duration_seconds: 30,
    distance_miles: null,
    weight_lbs: null,
    weight_delta_lbs: null,
    created_at: '2026-03-09T00:00:00.000Z',
    updated_at: '2026-03-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('exercise helpers', () => {
  it('normalizes a form state into exercise input values', () => {
    const normalized = normalizeExerciseDefinitionFormState({
      name: ' Weighted squat ',
      hasReps: true,
      repCount: '8',
      hasDuration: false,
      duration: '',
      hasDistance: true,
      distance: '3.5',
      hasWeight: true,
      weight: '135',
      hasWeightDelta: true,
      weightDelta: '5',
    });

    expect(normalized).toEqual({
      name: 'Weighted squat',
      rep_count: 8,
      duration_seconds: null,
      distance_miles: 3.5,
      weight_lbs: 135,
      weight_delta_lbs: 5,
    });
  });

  it('rejects invalid duration input', () => {
    expect(() => normalizeExerciseDefinitionFormState({
      name: 'Plank',
      hasReps: false,
      repCount: '',
      hasDuration: true,
      duration: '3m',
      hasDistance: false,
      distance: '',
      hasWeight: false,
      weight: '',
      hasWeightDelta: false,
      weightDelta: '',
    })).toThrow('Duration must be in mm:ss format.');
  });

  it('reorders duplicate routine exercise references without collapsing them', () => {
    expect(moveRoutineExercise(['a', 'b', 'a'], 2, -1)).toEqual(['a', 'a', 'b']);
  });

  it('summarizes exercise defaults for display', () => {
    expect(summarizeExerciseDefinition(buildDefinition({
      rep_count: 10,
      duration_seconds: 45,
      distance_miles: 2.5,
      weight_lbs: 35,
      weight_delta_lbs: 5,
    }))).toEqual(['10 reps', '00:45', '2.5 mi', '35 lb +/- 5 lb']);
  });

  it('creates a form state from an existing definition', () => {
    expect(createExerciseDefinitionFormState(buildDefinition({
      rep_count: 12,
      distance_miles: 1.25,
      weight_lbs: 20,
      weight_delta_lbs: 2.5,
    }))).toMatchObject({
      name: 'Plank',
      hasReps: true,
      repCount: '12',
      hasDuration: true,
      duration: '00:30',
      hasDistance: true,
      distance: '1.25',
      hasWeight: true,
      weight: '20',
      hasWeightDelta: true,
      weightDelta: '2.5',
    });
  });
});
