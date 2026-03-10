import React, { useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExerciseDefinitionsView } from '@/modules/exercise/components/ExerciseDefinitionsView';
import type { ExerciseDefinition, ExerciseDefinitionInput } from '@/modules/exercise/types/exercise';

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

function Harness() {
  const [definitions, setDefinitions] = useState<ExerciseDefinition[]>([]);

  const addDefinition = async (input: ExerciseDefinitionInput, id?: string) => {
    setDefinitions((current) => [...current, buildDefinition(id ?? `exercise-${current.length + 1}`, input.name, input)]);
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
  };

  return (
    <ExerciseDefinitionsView
      definitions={definitions}
      onAddDefinition={addDefinition}
      onUpdateDefinition={updateDefinition}
      onRemoveDefinition={removeDefinition}
      fullView
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

async function openMenu(element: Element | null) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
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

describe('ExerciseDefinitionsView', () => {
  it('supports adding, editing, and deleting exercises', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container, root } = mount(<Harness />);

    try {
      const addButton = container.querySelector('button[aria-label="Add Exercise"]');
      await click(addButton);

      const nameInput = document.body.querySelector('#exercise-definition-title') as HTMLInputElement | null;
      const durationToggle = document.body.querySelector('#exercise-definition-has-duration') as HTMLButtonElement | null;
      expect(nameInput).toBeTruthy();
      expect(durationToggle).toBeTruthy();

      if (nameInput) await dispatchInputChange(nameInput, 'Plank');
      await click(durationToggle);

      const durationInput = document.body.querySelector('#exercise-definition-duration') as HTMLInputElement | null;
      if (durationInput) await dispatchInputChange(durationInput, '00:30');

      const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Save');
      await click(saveButton ?? null);

      await waitForCondition(() => {
        expect(container.textContent).toContain('Reps');
        expect(container.textContent).toContain('Duration');
        const nameCells = Array.from(container.querySelectorAll('input[data-col="0"]')) as HTMLInputElement[];
        const durationCells = Array.from(container.querySelectorAll('input[data-col="2"]')) as HTMLInputElement[];
        expect(nameCells.some((input) => input.value === 'Plank')).toBe(true);
        expect(durationCells.some((input) => input.value === '00:30')).toBe(true);
      });

      const actionsButton = container.querySelector('button[aria-label="Actions for Plank"]');
      await openMenu(actionsButton);

      await waitForCondition(() => {
        const menu = document.body.querySelector('[role="menu"]');
        expect(menu?.textContent).toContain('Edit');
        expect(menu?.textContent).toContain('Delete');
      });

      const editButton = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Edit'));
      await click(editButton ?? null);

      const editNameInput = document.body.querySelector('#exercise-definition-title') as HTMLInputElement | null;
      const weightToggle = document.body.querySelector('#exercise-definition-has-weight') as HTMLButtonElement | null;
      if (editNameInput) await dispatchInputChange(editNameInput, 'Weighted plank');
      await click(weightToggle);

      const weightInput = document.body.querySelector('#exercise-definition-weight') as HTMLInputElement | null;
      if (weightInput) await dispatchInputChange(weightInput, '25');

      const secondSaveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Save');
      await click(secondSaveButton ?? null);

      await waitForCondition(() => {
        const nameCells = Array.from(container.querySelectorAll('input[data-col="0"]')) as HTMLInputElement[];
        const weightCells = Array.from(container.querySelectorAll('input[data-col="3"]')) as HTMLInputElement[];
        expect(nameCells.some((input) => input.value === 'Weighted plank')).toBe(true);
        expect(weightCells.some((input) => input.value === '25')).toBe(true);
      });

      const updatedActionsButton = container.querySelector('button[aria-label="Actions for Weighted plank"]');
      await openMenu(updatedActionsButton);

      const deleteButton = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Delete'));
      await click(deleteButton ?? null);

      await waitForCondition(() => {
        const nameCells = Array.from(container.querySelectorAll('input[data-col="0"]')) as HTMLInputElement[];
        expect(nameCells.some((input) => input.value === 'Weighted plank')).toBe(false);
        expect(container.textContent).toContain('Exercises');
      });
    } finally {
      unmount(root, container);
    }
  });
});
