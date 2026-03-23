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

function Harness({
  initialDefinitions = [
    buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
    buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
  ],
  initialRoutines = [],
}: {
  initialDefinitions?: ExerciseDefinition[];
  initialRoutines?: ExerciseRoutineWithItems[];
}) {
  const [definitions, setDefinitions] = useState<ExerciseDefinition[]>(initialDefinitions);
  const [routines, setRoutines] = useState<ExerciseRoutineWithItems[]>(initialRoutines);

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

function installFakeAlarmAudio() {
  class FakeAudioParam {
    exponentialRampToValueAtTime = vi.fn();
    setValueAtTime = vi.fn();
  }

  class FakeGainNode {
    connect = vi.fn();
    disconnect = vi.fn();
    gain = new FakeAudioParam();
  }

  class FakeOscillatorNode {
    connect = vi.fn();
    frequency = new FakeAudioParam();
    start = vi.fn();
    stop = vi.fn();
    type: OscillatorType = 'sine';
  }

  class FakeAudioContext {
    currentTime = 0;
    destination = {} as AudioDestinationNode;
    state: AudioContextState = 'suspended';

    close = vi.fn(async () => {
      this.state = 'closed';
    });

    createGain() {
      return new FakeGainNode() as unknown as GainNode;
    }

    createOscillator() {
      return new FakeOscillatorNode() as unknown as OscillatorNode;
    }

    resume = vi.fn(async () => {
      this.state = 'running';
    });

    suspend = vi.fn(async () => {
      this.state = 'suspended';
    });
  }

  const audioSession = { type: 'auto' as const };
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: FakeAudioContext,
    writable: true,
  });
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: audioSession,
  });

  return { audioSession };
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

async function swipeLeft(element: Element | null) {
  if (!element) return;
  await act(async () => {
    element.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      changedTouches: [{ clientX: 180 }] as unknown as TouchList,
    }));
    element.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      changedTouches: [{ clientX: 80 }] as unknown as TouchList,
    }));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(window, 'AudioContext');
  Reflect.deleteProperty(navigator, 'audioSession');
  vi.useRealTimers();
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
        expect(container.textContent).toContain('Add Routine');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('removes deleted exercises from saved routines', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container, root } = mount(<Harness initialDefinitions={[
      buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
      buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
      buildDefinition('exercise-3', 'Deadlift', { weight_lbs: 225, weight_delta_lbs: 10 }),
    ]} />);

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

  it('pages through routine cards and shows detailed exercise fields', async () => {
    const { container, root } = mount(<Harness initialDefinitions={[
      buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
      buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
      buildDefinition('exercise-3', 'Deadlift', { weight_lbs: 225, weight_delta_lbs: 10 }),
    ]} />);

    try {
      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine')) ?? null);

      const nameInput = container.querySelector('#exercise-routine-name') as HTMLInputElement | null;
      if (nameInput) await dispatchInputChange(nameInput, 'Detailed set');

      await click(container.querySelector('button[aria-label="Add Push-up to routine"]'));
      await click(container.querySelector('button[aria-label="Add Plank to routine"]'));
      await click(container.querySelector('button[aria-label="Add Deadlift to routine"]'));

      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save Routine') ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Detailed set');
        expect(container.textContent).toContain('1. Push-up');
        expect(container.textContent).toContain('Reps: 10');
        expect(container.textContent).not.toContain('Duration: Not Set');
        expect(container.textContent).not.toContain('Weight: Not Set');
        expect(container.textContent).not.toContain('Range: Not Set');
        expect(container.textContent).toContain('2. Plank');
        expect(container.textContent).toContain('Duration: 00:30');
        expect(container.querySelector('button[aria-label="Start 00:30 timer for Plank"]')).toBeTruthy();
        expect(container.textContent).toContain('3. Deadlift');
        expect(container.textContent).toContain('Weight: 225+/-10 lb');
        expect(container.textContent).not.toContain('Range: +/- 10 lb');
      });

      const viewport = container.querySelector('[data-testid="exercise-routine-card-viewport"]');
      await swipeLeft(viewport);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Create a new routine from the last card in the stack.');
      });

      await click(container.querySelector('button[aria-label="Next routine card"]'));

      await waitForCondition(() => {
        expect(container.textContent).toContain('Detailed set');
      });

      await click(container.querySelector('button[aria-label="Previous routine card"]'));

      await waitForCondition(() => {
        expect(container.textContent).toContain('Create a new routine from the last card in the stack.');
      });

      await click(container.querySelector('button[aria-label="Previous routine card"]'));

      await waitForCondition(() => {
        expect(container.textContent).toContain('Detailed set');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('starts a duration timer, enters alarm mode, and restores the audio session when dismissed', async () => {
    vi.useFakeTimers();
    const { audioSession } = installFakeAlarmAudio();

    const { container, root } = mount(<Harness
      initialDefinitions={[
        buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
        buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
      ]}
      initialRoutines={[
        buildRoutine('routine-1', 'Timed set', ['exercise-2']),
      ]}
    />);

    try {
      await click(container.querySelector('button[aria-label="Start 00:30 timer for Plank"]'));

      expect(document.body.textContent).toContain('Plank');
      expect(document.body.textContent).toContain('Running 00:30 timer.');
      expect(document.body.textContent).toContain('00:30');

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(document.body.textContent).toContain('00:29');

      await act(async () => {
        vi.advanceTimersByTime(29_000);
        await Promise.resolve();
      });

      expect(document.body.textContent).toContain('Time elapsed. The alarm will continue until you dismiss it.');
      expect(document.body.textContent).toContain('Dismiss Timer');
      expect(audioSession.type).toBe('transient-solo');

      await click(Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Dismiss Timer') ?? null);

      expect(document.body.textContent).not.toContain('Time elapsed. The alarm will continue until you dismiss it.');
      expect(audioSession.type).toBe('auto');
    } finally {
      unmount(root, container);
    }
  });
});
