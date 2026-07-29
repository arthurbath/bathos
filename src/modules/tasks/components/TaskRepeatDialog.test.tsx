import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskRecurrenceDefinitionFixture,
  taskRecurrenceOccurrenceFixture,
  taskRecurrenceRevisionFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import { TaskRepeatDialog } from './TaskRepeatDialog';

const mocks = vi.hoisted(() => ({
  useTasksRuntime: vi.fn(),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

const createFromTask = vi.fn();
const evaluate = vi.fn();
const onOpenChange = vi.fn();

function renderDialog(task = taskTodoFixture()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <TaskRepeatDialog
      task={task}
      planningDate="2026-07-27"
      open
      onOpenChange={onOpenChange}
    />,
  ));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
    input,
    value,
  );
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function selectBathosOption(label: string, optionLabel: string) {
  const trigger = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!trigger) throw new Error(`BathOS Select trigger not found: ${label}`);
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
    .find((candidate) => candidate.textContent?.trim() === optionLabel);
  if (!option) throw new Error(`BathOS Select option not found: ${optionLabel}`);
  await act(async () => {
    option.focus();
    option.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
}

describe('TaskRepeatDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    createFromTask.mockResolvedValue({
      outcome: 'accepted',
      definition: taskRecurrenceDefinitionFixture(),
      revision: taskRecurrenceRevisionFixture(),
      occurrence: taskRecurrenceOccurrenceFixture({ origin: 'adopted' }),
    });
    evaluate.mockResolvedValue({
      outcome: 'accepted',
      status: 'active',
      through_date: '2027-07-27',
      generated_count: 1,
      occurrence_ids: ['occurrence-a'],
      definition: taskRecurrenceDefinitionFixture(),
    });
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      recurrenceService: { createFromTask, evaluate },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('adopts the existing task and materializes a bounded calendar horizon', async () => {
    const task = taskTodoFixture({ id: 'task-repeat', title: 'Weekly Review' });
    const { container, root } = renderDialog(task);
    try {
      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        taskId: task.id,
        name: task.title,
        ruleMode: 'calendar',
        frequency: 'weekly',
        intervalCount: 1,
        scheduleDate: '2026-07-27',
        ruleConfig: { weekdays: [1] },
        endMode: 'never',
      }));
      expect(evaluate).toHaveBeenCalledTimes(4);
      expect(evaluate).toHaveBeenNthCalledWith(
        4,
        'recurrence-a',
        '2027-07-27',
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    } finally {
      cleanup(root, container);
    }
  });

  it('waits for completion instead of creating speculative successors', async () => {
    const task = taskTodoFixture({ id: 'task-after', title: 'Water Plants' });
    const { container, root } = renderDialog(task);
    try {
      await selectBathosOption('Repeat', 'After Completion');
      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        ruleMode: 'after_completion',
        frequency: 'weekly',
      }));
      expect(evaluate).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses shared BathOS Select controls for explicit monthly cadence', async () => {
    const task = taskTodoFixture({
      id: 'task-monthly-repeat',
      title: 'Monthly Review',
      start_date: '2026-08-01',
      deadline: '2026-08-03',
    });
    const { container, root } = renderDialog(task);
    try {
      expect(document.querySelectorAll('[role="combobox"]').length).toBeGreaterThanOrEqual(3);

      await selectBathosOption('Frequency', 'Months');
      await selectBathosOption('Monthly Pattern', 'Day-Type Position');
      await selectBathosOption('Monthly Ordinal', 'Last');
      await selectBathosOption('Monthly Day Type', 'Weekend Day');

      const offset = document.querySelector<HTMLInputElement>(
        'input[aria-label="Start Days Earlier"]',
      )!;
      await act(async () => setInput(offset, '7'));

      const preview = document.querySelector('[aria-label="Next Three Occurrences"]')!;
      expect(preview.querySelectorAll('li')).toHaveLength(3);
      expect(preview).toHaveTextContent('Start');
      expect(preview).toHaveTextContent('Deadline');
      expect(preview).toHaveTextContent('Aug 23, 2026');
      expect(preview).toHaveTextContent('Aug 30, 2026');

      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        scheduleDate: '2026-08-30',
        frequency: 'monthly',
        ruleConfig: {
          monthly_kind: 'ordinal_day_type',
          ordinal: -1,
          day_type: 'weekend_day',
        },
        deadlineOffsetDays: 7,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('uses shared BathOS Select controls for yearly ordinal-weekday cadence', async () => {
    const task = taskTodoFixture({
      id: 'task-yearly-repeat',
      title: 'Annual Review',
      start_date: '2026-01-01',
      deadline: null,
    });
    const { container, root } = renderDialog(task);
    try {
      await selectBathosOption('Frequency', 'Years');
      await selectBathosOption('Yearly Pattern', 'Weekday Position');
      await selectBathosOption('Yearly Month', 'May');
      await selectBathosOption('Yearly Ordinal', 'Second');
      await selectBathosOption('Yearly Weekday', 'Sunday');

      const preview = document.querySelector('[aria-label="Next Three Occurrences"]')!;
      expect(preview).toHaveTextContent('May 10, 2026');
      expect(preview).toHaveTextContent('May 9, 2027');
      expect(preview).toHaveTextContent('May 14, 2028');

      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        scheduleDate: '2026-05-10',
        frequency: 'yearly',
        ruleConfig: {
          yearly_kind: 'ordinal_weekday',
          month: 5,
          ordinal: 2,
          weekday: 7,
        },
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the Deadline as the schedule and derives Start by the chosen offset', async () => {
    const task = taskTodoFixture({
      id: 'task-deadline-repeat',
      title: 'Submit Report',
      start_date: '2026-08-01',
      deadline: '2026-08-03',
    });
    const { container, root } = renderDialog(task);
    try {
      const offset = document.querySelector<HTMLInputElement>(
        'input[aria-label="Start Days Earlier"]',
      )!;
      await act(async () => setInput(offset, '7'));
      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        scheduleDate: '2026-08-03',
        deadlineOffsetDays: 7,
      }));
    } finally {
      cleanup(root, container);
    }
  });
});
