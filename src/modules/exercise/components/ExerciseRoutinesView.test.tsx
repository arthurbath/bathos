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

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
}

if (!HTMLElement.prototype.hasPointerCapture) {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
}

if (!HTMLElement.prototype.releasePointerCapture) {
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => {},
  });
}

if (!HTMLElement.prototype.setPointerCapture) {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  });
}

function buildDefinition(id: string, name: string, overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id,
    user_id: 'user-1',
    name,
    rep_count: null,
    duration_seconds: null,
    distance_miles: null,
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
    let nextDefinition: ExerciseDefinition | null = null;
    setDefinitions((current) => {
      nextDefinition = buildDefinition(id ?? `exercise-${current.length + 1}`, input.name, input);
      return [
        ...current,
        nextDefinition,
      ];
    });
    if (!nextDefinition) {
      throw new Error('Expected definition to be created');
    }
    return nextDefinition;
  };

  const updateDefinition = async (id: string, input: ExerciseDefinitionInput) => {
    setDefinitions((current) => current.map((definition) => (
      definition.id === id
        ? buildDefinition(id, input.name, { ...definition, ...input })
        : definition
    )));
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
    if (!element) return;
    const PointerEventConstructor = window.PointerEvent ?? MouseEvent;
    element.dispatchEvent(new PointerEventConstructor('pointerdown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new PointerEventConstructor('pointerup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function focus(element: HTMLElement | null) {
  await act(async () => {
    element?.focus();
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

async function dispatchKeyDown(element: HTMLElement | null, key: string) {
  await act(async () => {
    element?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
  });
}

function getDefinitionSearchInput(container: HTMLElement) {
  return container.querySelector('#exercise-routine-definition-search') as HTMLInputElement | null;
}

async function addExerciseFromTypeToFind(container: HTMLElement, value: string, arrowDownCount = 0) {
  const input = getDefinitionSearchInput(container);
  expect(input).toBeTruthy();
  await focus(input);
  if (input) {
    await dispatchInputChange(input, value);
    for (let index = 0; index < arrowDownCount; index += 1) {
      await dispatchKeyDown(input, 'ArrowDown');
    }
    await dispatchKeyDown(input, 'Enter');
  }
}

async function openRoutineSelect(container: HTMLElement) {
  const trigger = container.querySelector('button[aria-label="Current routine"]');
  expect(trigger).toBeTruthy();
  await click(trigger);
}

async function selectRoutine(container: HTMLElement, name: string) {
  await openRoutineSelect(container);
  await waitForCondition(() => {
    expect(Array.from(document.body.querySelectorAll('[role="option"]')).some((item) => item.textContent === name)).toBe(true);
  });
  await click(Array.from(document.body.querySelectorAll('[role="option"]')).find((item) => item.textContent === name) ?? null);
}

afterEach(() => {
  document.body.innerHTML = '';
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
      expect(container.querySelector('label[for="exercise-routine-name"]')?.textContent).toBe('Name');
      expect(container.textContent).toContain('Order');
      expect(container.textContent).not.toContain('Save empty routines now and fill in the exercise order later.');
      expect(container.querySelector('[data-testid="exercise-routine-card-viewport"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Previous routine card"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Next routine card"]')).toBeNull();
      expect(container.textContent).not.toContain('No Routines Yet');
      if (nameInput) await dispatchInputChange(nameInput, 'Morning routine');

      await addExerciseFromTypeToFind(container, 'push');
      await addExerciseFromTypeToFind(container, 'plank');
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
        expect((container.querySelector('#exercise-routine-name') as HTMLInputElement | null)?.value).toBe('Morning routine');
      });

      await addExerciseFromTypeToFind(container, 'squat');
      expect(container.textContent).toContain('3. Squat');

      const saveRoutineButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save Routine');
      await click(saveRoutineButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Morning routine');
        expect(container.textContent).toContain('3 exercises');
      });

      await click(container.querySelector('button[aria-label="Actions for routine Morning routine"]'));
      await click(Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === 'Delete') ?? null);

      await waitForCondition(() => {
        expect(container.textContent).not.toContain('Morning routine');
        expect(container.textContent).toContain('Add Routine');
        expect(container.textContent).toContain('No Routines Yet');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('returns to the routine stack and scrolls to the top when canceling a draft', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
      writable: true,
    });

    const { container, root } = mount(<Harness initialRoutines={[
      buildRoutine('routine-1', 'Quick set', ['exercise-1']),
    ]} />);

    try {
      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine')) ?? null);

      expect(container.querySelector('[data-testid="exercise-routine-card-viewport"]')).toBeNull();

      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Cancel') ?? null);

      await waitForCondition(() => {
        expect(container.querySelector('[data-testid="exercise-routine-card-viewport"]')).toBeTruthy();
        expect(container.textContent).toContain('Quick set');
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
      });
    } finally {
      unmount(root, container);
    }
  });

  it('lists exercises alphabetically in the type-to-find popover and adds the highlighted result with the keyboard', async () => {
    const { container, root } = mount(<Harness initialDefinitions={[
      buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
      buildDefinition('exercise-2', 'Burpee', { duration_seconds: 45 }),
      buildDefinition('exercise-3', 'Deadlift', { weight_lbs: 225, weight_delta_lbs: 10 }),
      buildDefinition('exercise-4', 'Air Bike', { distance_miles: 2.5 }),
    ]} />);

    try {
      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine')) ?? null);

      const input = getDefinitionSearchInput(container);
      expect(input).toBeTruthy();
      await focus(input);

      await waitForCondition(() => {
        const optionTexts = Array.from(document.body.querySelectorAll('[role="option"]')).map((option) => option.textContent ?? '');
        expect(optionTexts).toHaveLength(4);
        expect(optionTexts[0]).toContain('Air Bike');
        expect(optionTexts[1]).toContain('Burpee');
        expect(optionTexts[2]).toContain('Deadlift');
        expect(optionTexts[3]).toContain('Push-up');
      });

      await dispatchKeyDown(input, 'ArrowDown');
      await dispatchKeyDown(input, 'Enter');

      await waitForCondition(() => {
        expect(container.textContent).toContain('1. Burpee');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('offers Add New Exercise for no-match queries and appends the saved definition to the draft order', async () => {
    const { container, root } = mount(<Harness initialDefinitions={[
      buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
      buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
    ]} />);

    try {
      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine')) ?? null);

      const input = getDefinitionSearchInput(container);
      expect(input).toBeTruthy();
      if (!input) return;

      await focus(input);
      await dispatchInputChange(input, 'Jump Rope');

      await waitForCondition(() => {
        const optionTexts = Array.from(document.body.querySelectorAll('[role="option"]')).map((option) => option.textContent ?? '');
        expect(optionTexts).toEqual(['Add New Exercise']);
      });

      await dispatchKeyDown(input, 'Enter');

      await waitForCondition(() => {
        expect((document.body.querySelector('#exercise-definition-title') as HTMLInputElement | null)?.value).toBe('Jump Rope');
      });

      await click(Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Save') ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('1. Jump Rope');
      });

      await addExerciseFromTypeToFind(container, 'Jump Rope');

      await waitForCondition(() => {
        expect(container.textContent).toContain('2. Jump Rope');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('switches routines from the selector and shows detailed exercise fields', async () => {
    const { container, root } = mount(<Harness initialDefinitions={[
      buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
      buildDefinition('exercise-2', 'Plank', { duration_seconds: 30 }),
      buildDefinition('exercise-4', 'Run', { distance_miles: 3.5 }),
      buildDefinition('exercise-3', 'Deadlift', { weight_lbs: 225, weight_delta_lbs: 10 }),
    ]} />);

    try {
      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine')) ?? null);

      const nameInput = container.querySelector('#exercise-routine-name') as HTMLInputElement | null;
      if (nameInput) await dispatchInputChange(nameInput, 'Detailed set');

      await addExerciseFromTypeToFind(container, 'push');
      await addExerciseFromTypeToFind(container, 'plank');
      await addExerciseFromTypeToFind(container, 'run');
      await addExerciseFromTypeToFind(container, 'dead');

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
        expect(container.textContent).toContain('3. Run');
        expect(container.textContent).toContain('Distance: 3.5 mi');
        expect(container.textContent).toContain('4. Deadlift');
        expect(container.textContent).toContain('Weight: 225+/-10 lb');
        expect(container.textContent).not.toContain('Range: +/- 10 lb');
      });

      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Routine')) ?? null);

      const secondNameInput = container.querySelector('#exercise-routine-name') as HTMLInputElement | null;
      if (secondNameInput) await dispatchInputChange(secondNameInput, 'Cardio set');

      await addExerciseFromTypeToFind(container, 'run');
      await click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save Routine') ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Detailed set');
        expect(container.querySelector('[data-testid="exercise-routine-card-viewport"]')?.textContent).not.toContain('Cardio set');
      });

      const routineSelectTrigger = container.querySelector('button[aria-label="Current routine"]');
      expect(routineSelectTrigger?.textContent).toContain('Detailed set');

      await openRoutineSelect(container);

      await waitForCondition(() => {
        const optionTexts = Array.from(document.body.querySelectorAll('[role="option"]')).map((option) => option.textContent ?? '');
        expect(optionTexts).toEqual(['Cardio set', 'Detailed set']);
      });

      await click(Array.from(document.body.querySelectorAll('[role="option"]')).find((item) => item.textContent === 'Cardio set') ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Cardio set');
        expect(container.textContent).toContain('1. Run');
        expect(container.querySelector('button[aria-label="Current routine"]')?.textContent).toContain('Cardio set');
      });

      await selectRoutine(container, 'Detailed set');

      await waitForCondition(() => {
        expect(container.textContent).toContain('Detailed set');
        expect(container.textContent).toContain('Reps: 10');
      });
    } finally {
      unmount(root, container);
    }
  });

  it('starts a duration timer and shows silent completion state when it ends', async () => {
    vi.useFakeTimers();

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
      expect(document.body.textContent).toContain('00:30 timer');
      expect(document.body.textContent).toContain('00:30');

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(document.body.textContent).toContain('00:29');

      await act(async () => {
        vi.advanceTimersByTime(29_000);
        await Promise.resolve();
      });

      expect(document.body.textContent).toContain('00:30 timer');
      expect(document.body.textContent).toContain('Dismiss');
      expect(document.body.textContent).toContain('Complete');
      expect(document.body.textContent).toContain('00:00');

      await click(Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Dismiss') ?? null);

      expect(document.body.textContent).not.toContain('Dismiss');
    } finally {
      unmount(root, container);
    }
  });
});
