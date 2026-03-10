import React, { useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExerciseRoutinesView } from '@/modules/exercise/components/ExerciseRoutinesView';
import type {
  ExerciseDefinition,
  ExerciseDefinitionInput,
  ExerciseRoutineInput,
  ExerciseRoutineWithItems,
} from '@/modules/exercise/types/exercise';

function buildDefinition(id: string, name: string, overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id,
    user_id: 'user-1',
    name,
    rep_count: null,
    duration_seconds: null,
    weight_lbs: null,
    weight_delta_lbs: null,
    created_at: '2026-03-09T00:00:00.000Z',
    updated_at: '2026-03-09T00:00:00.000Z',
    ...overrides,
  };
}

function buildRoutine(id: string, name: string, exerciseDefinitionIds: string[]): ExerciseRoutineWithItems {
  return {
    id,
    user_id: 'user-1',
    name,
    created_at: '2026-03-09T00:00:00.000Z',
    updated_at: '2026-03-09T00:00:00.000Z',
    items: exerciseDefinitionIds.map((exerciseDefinitionId, index) => ({
      id: `${id}-item-${index}`,
      routine_id: id,
      exercise_definition_id: exerciseDefinitionId,
      sort_order: index,
    })),
  };
}

function Harness() {
  const [definitions, setDefinitions] = useState<ExerciseDefinition[]>([
    buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
    buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
  ]);
  const [routines, setRoutines] = useState<ExerciseRoutineWithItems[]>([]);

  const addDefinition = async (input: ExerciseDefinitionInput, id?: string) => {
    setDefinitions((current) => [
      ...current,
      buildDefinition(id ?? `exercise-${current.length + 1}`, input.name, input),
    ]);
  };

  const updateDefinition = async (id: string, input: ExerciseDefinitionInput) => {
    setDefinitions((current) => current.map((definition) => (
      definition.id === id
        ? buildDefinition(id, input.name, { ...definition, ...input })
        : definition
    )));
  };

  const removeDefinition = async (id: string) => {
    setDefinitions((current) => current.filter((definition) => definition.id !== id));
    setRoutines((current) => current.map((routine) => ({
      ...routine,
      items: routine.items
        .filter((item) => item.exercise_definition_id !== id)
        .map((item, index) => ({ ...item, sort_order: index })),
    })));
  };

  const addRoutine = async (input: ExerciseRoutineInput) => {
    setRoutines((current) => [
      ...current,
      buildRoutine(`routine-${current.length + 1}`, input.name, input.exercise_definition_ids),
    ]);
  };

  const updateRoutine = async (id: string, input: ExerciseRoutineInput) => {
    setRoutines((current) => current.map((routine) => (
      routine.id === id ? buildRoutine(id, input.name, input.exercise_definition_ids) : routine
    )));
  };

  const removeRoutine = async (id: string) => {
    setRoutines((current) => current.filter((routine) => routine.id !== id));
  };

  return (
    <ExerciseRoutinesView
      definitions={definitions}
      routines={routines}
      onAddDefinition={addDefinition}
      onUpdateDefinition={updateDefinition}
      onRemoveDefinition={removeDefinition}
      onAddRoutine={addRoutine}
      onUpdateRoutine={updateRoutine}
      onRemoveRoutine={removeRoutine}
    />
  );
}

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function waitForCondition(assertion: () => void, timeoutMs = 1000) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start <= timeoutMs) {
    try {
      assertion();
      return;
    } catch (error: unknown) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }
  throw lastError instanceof Error ? lastError : new Error('Condition not met before timeout');
}

async function click(element: Element | null) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function dispatchInputChange(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  const setValue = prototypeSetter && valueSetter !== prototypeSetter ? prototypeSetter : valueSetter;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ExerciseRoutinesView', () => {
  it('creates, reorders, and deletes routines while keeping the draft during in-context exercise edits', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container, root } = mount(<Harness />);

    try {
      const addRoutineButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine'));
      await click(addRoutineButton ?? null);

      const nameInput = container.querySelector('#exercise-routine-name') as HTMLInputElement | null;
      expect(nameInput).toBeTruthy();
      if (nameInput) await dispatchInputChange(nameInput, 'Morning routine');

      await click(container.querySelector('button[aria-label="Add Push-up to routine"]'));
      await click(container.querySelector('button[aria-label="Add Plank to routine"]'));

      expect(container.textContent).toContain('1. Push-up');
      expect(container.textContent).toContain('2. Plank');

      await click(container.querySelector('button[aria-label="Move Plank up"]'));

      await waitForCondition(() => {
        expect(container.textContent).toContain('1. Plank');
        expect(container.textContent).toContain('2. Push-up');
      });

      const newExerciseButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'New Exercise');
      await click(newExerciseButton ?? null);

      const exerciseNameInput = document.body.querySelector('#exercise-definition-title') as HTMLInputElement | null;
      const repsToggle = document.body.querySelector('#exercise-definition-has-reps') as HTMLButtonElement | null;
      if (exerciseNameInput) await dispatchInputChange(exerciseNameInput, 'Squat');
      await click(repsToggle);

      const repCountInput = document.body.querySelector('#exercise-definition-reps') as HTMLInputElement | null;
      if (repCountInput) await dispatchInputChange(repCountInput, '8');

      const saveExerciseButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Save');
      await click(saveExerciseButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Squat');
        expect((container.querySelector('#exercise-routine-name') as HTMLInputElement | null)?.value).toBe('Morning routine');
      });

      await click(container.querySelector('button[aria-label="Add Squat to routine"]'));

      const saveRoutineButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save Routine');
      await click(saveRoutineButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Morning routine');
        expect(container.textContent).toContain('3 exercises');
      });

      await click(container.querySelector('button[aria-label="Delete routine Morning routine"]'));

      await waitForCondition(() => {
        expect(container.textContent).not.toContain('Morning routine');
        expect(container.textContent).toContain('Routines');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('removes deleted exercises from saved routines', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container, root } = mount(<Harness />);

    try {
      const addRoutineButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine'));
      await click(addRoutineButton ?? null);

      const nameInput = container.querySelector('#exercise-routine-name') as HTMLInputElement | null;
      if (nameInput) await dispatchInputChange(nameInput, 'Quick set');

      await click(container.querySelector('button[aria-label="Add Push-up to routine"]'));

      const saveRoutineButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save Routine');
      await click(saveRoutineButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Quick set');
        expect(container.textContent).toContain('1 exercise');
      });

      await click(container.querySelector('button[aria-label="Edit Routine Quick set"]'));
      await click(container.querySelector('button[aria-label="Delete Push-up"]'));

      await waitForCondition(() => {
        expect(container.textContent).toContain('No exercises in this routine yet');
        expect(container.textContent).not.toContain('1. Push-up');
      });
    } finally {
      unmount(root, container);
    }
  });
});
