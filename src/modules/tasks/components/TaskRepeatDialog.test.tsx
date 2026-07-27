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

function setSelect(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(
    select,
    value,
  );
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
    input,
    value,
  );
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TaskRepeatDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
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
      const mode = document.querySelectorAll<HTMLSelectElement>('select')[0];
      await act(async () => setSelect(mode, 'after_completion'));
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
