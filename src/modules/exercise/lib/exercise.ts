import type { ExerciseDefinition, ExerciseDefinitionFormState, ExerciseDefinitionInput } from '@/modules/exercise/types/exercise';

function trimTrailingZeroes(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function parseOptionalPositiveNumber(raw: string, label: string): number {
  const normalized = raw.trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return parsed;
}

function parseOptionalNonNegativeNumber(raw: string, label: string): number {
  const normalized = raw.trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return parsed;
}

export function formatWeightLbs(value: number): string {
  return trimTrailingZeroes(value.toFixed(2));
}

export function formatDurationSeconds(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDurationMs(value: number): string {
  const totalSeconds = Math.ceil(Math.max(0, value) / 1000);
  return formatDurationSeconds(totalSeconds);
}

export function parseDurationInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Duration is required.');
  }

  const match = trimmed.match(/^(\d+):([0-5]\d)$/);
  if (!match) {
    throw new Error('Duration must be in mm:ss format.');
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = (minutes * 60) + seconds;
  if (total <= 0) {
    throw new Error('Duration must be greater than 0.');
  }
  return total;
}

export function createExerciseDefinitionFormState(definition?: ExerciseDefinition | null): ExerciseDefinitionFormState {
  return {
    name: definition?.name ?? '',
    hasReps: definition?.rep_count != null,
    repCount: definition?.rep_count != null ? String(definition.rep_count) : '',
    hasDuration: definition?.duration_seconds != null,
    duration: definition?.duration_seconds != null ? formatDurationSeconds(definition.duration_seconds) : '',
    hasWeight: definition?.weight_lbs != null,
    weight: definition?.weight_lbs != null ? formatWeightLbs(definition.weight_lbs) : '',
    hasWeightDelta: definition?.weight_delta_lbs != null,
    weightDelta: definition?.weight_delta_lbs != null ? formatWeightLbs(definition.weight_delta_lbs) : '',
  };
}

export function normalizeExerciseDefinitionFormState(state: ExerciseDefinitionFormState): ExerciseDefinitionInput {
  const name = state.name.trim();
  if (!name) {
    throw new Error('Exercise name is required.');
  }

  const rep_count = state.hasReps ? Math.round(parseOptionalPositiveNumber(state.repCount, 'Reps')) : null;
  const duration_seconds = state.hasDuration ? parseDurationInput(state.duration) : null;
  const weight_lbs = state.hasWeight ? parseOptionalPositiveNumber(state.weight, 'Weight') : null;
  const weight_delta_lbs = state.hasWeightDelta
    ? parseOptionalNonNegativeNumber(state.weightDelta, 'Weight range')
    : null;

  if (weight_delta_lbs != null && weight_lbs == null) {
    throw new Error('A weight range requires a base weight.');
  }

  return {
    name,
    rep_count,
    duration_seconds,
    weight_lbs,
    weight_delta_lbs,
  };
}

export function formatExerciseWeight(definition: Pick<ExerciseDefinition, 'weight_lbs' | 'weight_delta_lbs'>): string | null {
  if (definition.weight_lbs == null) return null;
  const base = `${formatWeightLbs(definition.weight_lbs)} lb`;
  if (definition.weight_delta_lbs == null || definition.weight_delta_lbs === 0) {
    return base;
  }
  return `${base} +/- ${formatWeightLbs(definition.weight_delta_lbs)} lb`;
}

export function summarizeExerciseDefinition(definition: ExerciseDefinition): string[] {
  const parts: string[] = [];
  if (definition.rep_count != null) {
    parts.push(`${definition.rep_count} reps`);
  }
  if (definition.duration_seconds != null) {
    parts.push(formatDurationSeconds(definition.duration_seconds));
  }
  const weight = formatExerciseWeight(definition);
  if (weight) {
    parts.push(weight);
  }
  return parts;
}

export function moveRoutineExercise(
  exerciseDefinitionIds: string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const nextIndex = index + direction;
  if (index < 0 || index >= exerciseDefinitionIds.length) return exerciseDefinitionIds;
  if (nextIndex < 0 || nextIndex >= exerciseDefinitionIds.length) return exerciseDefinitionIds;

  const next = [...exerciseDefinitionIds];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}
