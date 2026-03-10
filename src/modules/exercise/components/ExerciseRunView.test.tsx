import React, { useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ExerciseRunView } from '@/modules/exercise/components/ExerciseRunView';
import type { ExerciseDefinition, ExerciseDefinitionInput, ExerciseRoutineWithItems } from '@/modules/exercise/types/exercise';

const oscillatorStartMock = vi.fn();
const requestWakeLockMock = vi.fn();
const releaseWakeLockMock = vi.fn(async () => {});

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {};

  async resume() {
    this.state = 'running';
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: oscillatorStartMock,
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }

  async close() {}
}

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

function Harness({ empty = false }: { empty?: boolean }) {
  const [definitions, setDefinitions] = useState<ExerciseDefinition[]>(empty ? [] : [
    buildDefinition('exercise-1', 'Push-up', { rep_count: 10 }),
    buildDefinition('exercise-2', 'Plank', { duration_seconds: 3 }),
  ]);
  const [routines] = useState<ExerciseRoutineWithItems[]>(empty ? [] : [
    buildRoutine('routine-1', 'Morning', ['exercise-1', 'exercise-2', 'exercise-2']),
  ]);

  const updateDefinition = async (id: string, input: ExerciseDefinitionInput) => {
    setDefinitions((current) => current.map((definition) => (
      definition.id === id
        ? buildDefinition(id, input.name, { ...definition, ...input })
        : definition
    )));
  };

  return (
    <MemoryRouter initialEntries={['/exercise/run']}>
      <ExerciseRunView
        basePath="/exercise"
        definitions={definitions}
        routines={routines}
        onUpdateDefinition={updateDefinition}
      />
    </MemoryRouter>
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

beforeEach(() => {
  vi.useFakeTimers();
  oscillatorStartMock.mockReset();
  releaseWakeLockMock.mockReset();
  requestWakeLockMock.mockReset();
  requestWakeLockMock.mockResolvedValue({ released: false, release: releaseWakeLockMock });

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: MockAudioContext,
  });

  Object.defineProperty(window.navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: requestWakeLockMock,
    },
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ExerciseRunView', () => {
  it('shows the empty state when no runnable routines exist', () => {
    const { container, root } = mount(<Harness empty />);
    try {
      expect(container.textContent).toContain('No runnable routines yet.');
      const routinesLink = container.querySelector('a[href="/exercise/routines"]');
      const exercisesLink = container.querySelector('a[href="/exercise/exercises"]');
      expect(routinesLink?.textContent).toContain('Go to Routines');
      expect(exercisesLink?.textContent).toContain('Go to Exercises');
    } finally {
      unmount(root, container);
    }
  });

  it('runs through a routine, controls the timer, and persists in-run exercise edits', async () => {
    const { container, root } = mount(<Harness />);

    try {
      const startRunButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Start Run');
      await click(startRunButton ?? null);

      await waitForCondition(() => {
        expect(requestWakeLockMock).toHaveBeenCalled();
        expect(container.textContent).toContain('Push-up');
      });

      const nextButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Next');
      await click(nextButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Plank');
        expect(container.textContent).toContain('00:03');
      });

      const startTimerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Start Timer');
      await click(startTimerButton ?? null);

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(container.textContent).toContain('00:02');

      const pauseButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pause');
      const resetButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reset');
      await click(pauseButton ?? null);
      await click(resetButton ?? null);
      expect(container.textContent).toContain('00:03');

      const secondStartTimerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Start Timer');
      await click(secondStartTimerButton ?? null);

      await act(async () => {
        vi.advanceTimersByTime(3200);
      });

      await waitForCondition(() => {
        expect(container.textContent).toContain('00:00');
        expect(oscillatorStartMock).toHaveBeenCalledTimes(2);
      });

      const editButton = container.querySelector('button[aria-label="Edit Plank"]');
      await click(editButton);

      const durationInput = document.body.querySelector('#exercise-definition-duration') as HTMLInputElement | null;
      if (durationInput) await dispatchInputChange(durationInput, '00:05');

      const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Save');
      await click(saveButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('00:05');
      });

      const nextAgainButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Next');
      await click(nextAgainButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Exercise 3 of 3');
        expect(container.textContent).toContain('00:05');
      });

      const finishButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Finish Run');
      await click(finishButton ?? null);

      await waitForCondition(() => {
        expect(releaseWakeLockMock).toHaveBeenCalled();
        expect(container.textContent).toContain('Choose a routine to start a live run.');
      });
    } finally {
      unmount(root, container);
    }
  });
});
