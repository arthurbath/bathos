import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

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
const edit = vi.fn();
const evaluate = vi.fn();
const onOpenChange = vi.fn();

function renderDialog(
  task = taskTodoFixture(),
  recurrence?: {
    definition: ReturnType<typeof taskRecurrenceDefinitionFixture>;
    revision: ReturnType<typeof taskRecurrenceRevisionFixture>;
  },
  planningDate = '2026-07-27',
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <TaskRepeatDialog
      task={task}
      planningDate={planningDate}
      open
      onOpenChange={onOpenChange}
      definition={recurrence?.definition}
      revision={recurrence?.revision}
      onEdit={edit}
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
    edit.mockResolvedValue({
      outcome: 'accepted',
      definition: taskRecurrenceDefinitionFixture({ current_revision: 2 }),
      revision: taskRecurrenceRevisionFixture({ revision: 2 }),
    });
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      recurrenceService: { createFromTask, edit, evaluate },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('saves the prototype without materializing a future calendar horizon', async () => {
    const task = taskTodoFixture({
      id: 'task-repeat',
      title: 'Weekly Review',
      start_date: '2026-08-03',
    });
    createFromTask.mockResolvedValueOnce({
      outcome: 'accepted',
      definition: taskRecurrenceDefinitionFixture({
        next_occurrence_date: '2026-08-03',
      }),
      revision: taskRecurrenceRevisionFixture({ start_date: '2026-08-03' }),
      occurrence: null,
    });
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
        ruleMode: 'calendar',
        frequency: 'weekly',
        intervalCount: 1,
        nextStartDate: '2026-08-03',
        dateBasis: 'start',
        ruleConfig: { version: 2, weekdays: [1] },
        endMode: 'never',
      }));
      expect(evaluate).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    } finally {
      cleanup(root, container);
    }
  });

  it('waits for completion instead of creating speculative successors', async () => {
    const task = taskTodoFixture({ id: 'task-after', title: 'Water Plants' });
    const { container, root } = renderDialog(task);
    try {
      await selectBathosOption('Repeat Type', 'After Completion');
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

  it('asks about deadlines before presenting the basis-specific date fields', async () => {
    const task = taskTodoFixture({
      id: 'task-deadline-flow',
      title: 'Plan Event',
      start_date: '2026-08-03',
      deadline: null,
    });
    const { container, root } = renderDialog(task);
    try {
      const deadlineToggle = document.querySelector<HTMLButtonElement>(
        '[role="switch"][aria-label="Tasks Have Deadlines"]',
      );
      expect(deadlineToggle).toBeTruthy();
      expect(document.body).toHaveTextContent('Next Starts on');
      expect(document.querySelector('[aria-label="Next Date Type"]')).toBeNull();

      await act(async () => deadlineToggle?.click());

      expect(document.querySelector('[aria-label="Next Date Type"]')).toBeTruthy();
      expect(document.querySelector('[data-task-repeat-anchor-preposition]'))
        .toHaveTextContent('on');
      expect(document.body).toHaveTextContent('With Deadlines');
      expect(document.body).toHaveTextContent('Days After');
      expect(document.body).not.toHaveTextContent('Next Deadline');
    } finally {
      cleanup(root, container);
    }
  });

  it('normalizes an empty or invalid deadline offset to zero on blur', async () => {
    const task = taskTodoFixture({
      id: 'task-offset-normalization',
      title: 'Plan Event',
      start_date: '2026-08-03',
      deadline: '2026-08-05',
    });
    const { container, root } = renderDialog(task);
    try {
      const offset = document.querySelector<HTMLInputElement>(
        'input[aria-label="Days After Start"]',
      )!;
      await act(async () => {
        offset.focus();
        setInput(offset, 'not-a-number');
        offset.blur();
      });
      expect(offset).toHaveValue('0');

      await act(async () => {
        offset.focus();
        setInput(offset, '');
        offset.blur();
      });
      expect(offset).toHaveValue('0');
    } finally {
      cleanup(root, container);
    }
  });

  it('presents compact and tablet weekday labels from the same controls', () => {
    const { container, root } = renderDialog(taskTodoFixture({ start_date: '2026-08-03' }));
    try {
      const monday = document.querySelector<HTMLButtonElement>('[aria-label="Monday"]')!;
      expect(monday.querySelector('.md\\:hidden')).toHaveTextContent('M');
      expect(monday.querySelector('.md\\:inline')).toHaveTextContent('Mon');
    } finally {
      cleanup(root, container);
    }
  });

  it('allows temporary interval edits and normalizes invalid values to one on blur', async () => {
    const task = taskTodoFixture({ id: 'task-interval-edit', start_date: '2026-08-03' });
    const { container, root } = renderDialog(task);
    try {
      const interval = document.querySelector<HTMLInputElement>(
        'input[aria-label="Repeat Interval"]',
      )!;

      await act(async () => {
        interval.focus();
        setInput(interval, '');
      });
      expect(interval).toHaveValue(null);

      await act(async () => interval.blur());
      expect(interval).toHaveValue(1);

      await act(async () => {
        interval.focus();
        setInput(interval, '-4');
        interval.blur();
      });
      expect(interval).toHaveValue(1);

      await act(async () => {
        interval.focus();
        setInput(interval, '12');
        interval.blur();
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        intervalCount: 12,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('presents scheduled cadence as tightly grouped phrasal controls', async () => {
    const { container, root } = renderDialog(taskTodoFixture({ start_date: '2026-08-03' }));
    try {
      const cadencePhrase = document.querySelector<HTMLElement>('[data-task-repeat-cadence-phrase]')!;
      const monday = document.querySelector<HTMLButtonElement>('[aria-label="Monday"]')!;
      const tuesday = document.querySelector<HTMLButtonElement>('[aria-label="Tuesday"]')!;
      expect(cadencePhrase).toHaveClass('space-y-2');
      expect(cadencePhrase).toHaveTextContent('Repeat');
      expect(document.querySelector('[aria-label="Repeat Type"]')).toHaveTextContent('On a Schedule');
      expect(cadencePhrase).toHaveTextContent('Every');
      expect(cadencePhrase).toHaveTextContent('On');
      expect(monday).toHaveAttribute('aria-pressed', 'true');
      expect(monday).toHaveClass('bg-success');
      expect(tuesday).toHaveAttribute('aria-pressed', 'false');
      expect(tuesday).not.toHaveClass('bg-success');
      expect(monday).toHaveClass('w-full');
      expect(monday).not.toHaveClass('md:w-14');

      await selectBathosOption('Frequency', 'Month');
      expect(cadencePhrase).toHaveTextContent('On the');

      await selectBathosOption('Frequency', 'Year');
      expect(cadencePhrase).toHaveTextContent('In');
      expect(cadencePhrase).toHaveTextContent('On the');
      expect(document.querySelector('[aria-label="Months"]')).toHaveTextContent('Aug');
    } finally {
      cleanup(root, container);
    }
  });

  it('groups the two deadline sentence rows more tightly than major concepts', () => {
    const { container, root } = renderDialog(taskTodoFixture({
      start_date: '2026-08-03',
      deadline: '2026-08-05',
    }));
    try {
      const deadlinesToggleRow = document.querySelector<HTMLElement>(
        '[aria-label="Tasks Have Deadlines"]',
      )!.parentElement!;
      const datePhrase = document.querySelector<HTMLElement>('[data-task-repeat-date-phrase]')!;
      expect(deadlinesToggleRow).toHaveClass('!mt-7');
      expect(datePhrase).toHaveClass('!mt-7', 'space-y-2');
      expect(datePhrase).toHaveTextContent('Next');
      expect(datePhrase).toHaveTextContent('With Deadlines');
    } finally {
      cleanup(root, container);
    }
  });

  it('summarizes yearly months with short names and an ellipsis after seven', () => {
    const recurrence = {
      definition: taskRecurrenceDefinitionFixture(),
      revision: taskRecurrenceRevisionFixture({
        frequency: 'yearly',
        start_date: '2026-01-05',
        rule_config: {
          version: 2,
          months: [1, 2, 3, 4, 5, 6, 7, 8],
          position: 5,
          day_type: 'day',
        },
      }),
    };
    const { container, root } = renderDialog(taskTodoFixture({ start_date: '2026-01-05' }), recurrence);
    try {
      const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Months"]')!;
      expect(trigger).toHaveTextContent('Jan, Feb, Mar, Apr, May, Jun, Jul, ...');
      expect(trigger).not.toHaveTextContent('8 Months');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the Start picker reminder field and hour-menu paradigms', async () => {
    const user = userEvent.setup();
    const { container, root } = renderDialog(taskTodoFixture({ start_date: '2026-08-03' }));
    try {
      const toggle = document.querySelector<HTMLButtonElement>(
        '[role="switch"][aria-label="Tasks Have Reminders"]',
      );
      expect(toggle).toBeTruthy();
      await act(async () => toggle?.click());

      const input = document.querySelector<HTMLInputElement>('[aria-label="Reminder Time"]');
      const hourButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Choose Reminder Hour"]',
      );
      expect(input).toHaveValue('12:00 pm');
      expect(input?.closest('[data-slot="input-group"]')).toBeTruthy();
      expect(hourButton).toBeTruthy();

      await user.click(hourButton!);
      expect(document.body.querySelectorAll('[role="menuitemradio"]')).toHaveLength(24);
    } finally {
      cleanup(root, container);
    }
  });

  it('disables reminders when a committed reminder value is empty or unparseable', async () => {
    const user = userEvent.setup();
    const { container, root } = renderDialog(taskTodoFixture({ start_date: '2026-08-03' }));
    try {
      const enableReminders = async () => {
        await user.click(document.querySelector<HTMLButtonElement>(
          '[role="switch"][aria-label="Tasks Have Reminders"]',
        )!);
      };

      await enableReminders();
      let input = document.querySelector<HTMLInputElement>('[aria-label="Reminder Time"]')!;
      await user.clear(input);
      await user.tab();

      expect(document.querySelector('[role="switch"][aria-label="Tasks Have Reminders"]'))
        .toHaveAttribute('aria-checked', 'false');
      expect(document.querySelector('[aria-label="Reminder Time"]')).toBeNull();

      await enableReminders();
      input = document.querySelector<HTMLInputElement>('[aria-label="Reminder Time"]')!;
      await user.clear(input);
      await user.type(input, 'not remotely a time{Enter}');

      expect(document.querySelector('[role="switch"][aria-label="Tasks Have Reminders"]'))
        .toHaveAttribute('aria-checked', 'false');
      expect(document.querySelector('[aria-label="Reminder Time"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('balances repeat modal body padding above and below its content', () => {
    const { container, root } = renderDialog(taskTodoFixture({ start_date: '2026-08-03' }));
    try {
      const body = document.querySelector<HTMLElement>('[data-dialog-body="true"]')!;
      expect(body).toHaveClass('pt-[25px]');
      expect(body).toHaveClass('pb-[25px]');
    } finally {
      cleanup(root, container);
    }
  });

  it('allows only configured weekdays in a scheduled repeat anchor picker', async () => {
    const task = taskTodoFixture({
      id: 'task-weekday-picker',
      title: 'Monday Planning',
      start_date: '2026-08-03',
      deadline: null,
    });
    const { container, root } = renderDialog(task);
    try {
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[aria-label="Next Start"]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(document.body.querySelector<HTMLButtonElement>(
        'button[name="day"][data-calendar-date="2026-08-03"]',
      )).toBeEnabled();
      expect(document.body.querySelector<HTMLButtonElement>(
        'button[name="day"][data-calendar-date="2026-08-04"]',
      )).toBeDisabled();
    } finally {
      cleanup(root, container);
    }
  });

  it('allows any otherwise legal date for an after-completion anchor', async () => {
    const task = taskTodoFixture({
      id: 'task-after-picker',
      title: 'Water Plants',
      start_date: '2026-08-03',
      deadline: null,
    });
    const { container, root } = renderDialog(task);
    try {
      await selectBathosOption('Repeat Type', 'After Completion');
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[aria-label="Next Start"]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(document.body.querySelector<HTMLButtonElement>(
        'button[name="day"][data-calendar-date="2026-08-04"]',
      )).toBeEnabled();
    } finally {
      cleanup(root, container);
    }
  });

  it('revises only an after-completion cadence and leaves prototype metadata to the drawer', async () => {
    const task = taskTodoFixture({ id: 'task-after-edit', title: 'Water Plants' });
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-after-edit',
      name: task.title,
      current_revision: 3,
      record_revision: 4,
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      revision: 3,
      rule_mode: 'after_completion',
      frequency: 'monthly',
      interval_count: 2,
      start_date: '2026-08-15',
      end_mode: 'after',
      end_after_count: 8,
      rule_config: {},
    });
    const { container, root } = renderDialog(task, { definition, revision });
    try {
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.body).toHaveTextContent('Edit Repeat');
      expect(document.body).toHaveTextContent('Next Start');
      expect(document.querySelector('[data-task-repeat-summary]')).toHaveTextContent(task.title);
      expect(document.body).not.toHaveTextContent('Ends');
      expect(document.querySelector('input[aria-label="Summary"]')).toBeNull();
      expect(document.querySelector('[aria-label="Prototype Content"]')).toBeNull();
      expect(document.querySelector('input[aria-label="Link"]')).toBeNull();
      expect(document.querySelector('[aria-label="Checklist"]')).toBeNull();

      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(edit).toHaveBeenCalledWith(expect.objectContaining({
        definition,
        revision,
        ruleMode: 'after_completion',
        frequency: 'monthly',
        intervalCount: 2,
        nextStartDate: '2026-08-15',
        dateBasis: 'start',
        endMode: 'never',
        endAfterCount: null,
        endOnDate: null,
      }));
      expect(edit.mock.calls[0]?.[0]).not.toHaveProperty('prototypeSnapshot');
      expect(edit.mock.calls[0]?.[0]).not.toHaveProperty('targetAreaId');
      expect(createFromTask).not.toHaveBeenCalled();
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
      expect(document.querySelectorAll('[role="combobox"]').length).toBeGreaterThanOrEqual(2);

      await selectBathosOption('Frequency', 'Month');
      await selectBathosOption('Ordinal', 'Last');
      await selectBathosOption('Day Type', 'Weekend Day');

      const offset = document.querySelector<HTMLInputElement>(
        'input[aria-label="Days After Start"]',
      )!;
      await act(async () => setInput(offset, '7'));

      const preview = document.querySelector('[aria-label="Next Occurrences"]')!;
      expect(preview.querySelectorAll('li')).toHaveLength(3);
      expect(preview).toHaveTextContent('Start');
      expect(preview).toHaveTextContent('Deadline');
      expect(preview).toHaveTextContent('2026 Sep 27');
      expect(preview).toHaveTextContent('2026 Oct 4');

      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        nextStartDate: '2026-09-27',
        dateBasis: 'start',
        frequency: 'monthly',
        ruleConfig: {
          version: 2,
          position: 'last',
          day_type: 'weekend_day',
        },
        deadlineAfterStartDays: 7,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('uses shared BathOS Select controls for yearly ordinal-weekday cadence', async () => {
    const task = taskTodoFixture({
      id: 'task-yearly-repeat',
      title: 'Annual Review',
      start_date: '2026-05-10',
      deadline: null,
    });
    const { container, root } = renderDialog(task);
    try {
      await selectBathosOption('Frequency', 'Year');
      await selectBathosOption('Ordinal', '2nd');
      await selectBathosOption('Day Type', 'Sunday');

      const preview = document.querySelector('[aria-label="Next Occurrences"]')!;
      expect(preview).toHaveTextContent('2027 Jul 11');
      expect(preview).toHaveTextContent('2028 Jul 9');
      expect(preview).toHaveTextContent('2029 Jul 8');

      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        nextStartDate: '2027-07-11',
        dateBasis: 'start',
        frequency: 'yearly',
        ruleConfig: {
          version: 2,
          months: [7],
          position: 2,
          day_type: 'sunday',
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
        'input[aria-label="Days After Start"]',
      )!;
      await act(async () => setInput(offset, '7'));
      await selectBathosOption('Next Date Type', 'Due');
      expect(document.querySelector('[aria-label="Next Deadline"]')).toBeTruthy();
      expect(document.querySelector('[data-task-repeat-anchor-preposition]'))
        .toHaveTextContent('on');
      expect(document.body).toHaveTextContent('And Starts');
      expect(document.body).toHaveTextContent('Days Prior');
      expect(document.body).not.toHaveTextContent('With Deadlines');
      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });

      expect(createFromTask).toHaveBeenCalledWith(expect.objectContaining({
        nextStartDate: '2026-08-01',
        dateBasis: 'deadline',
        deadlineAfterStartDays: 7,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('allows an existing prototype to accept an implied start date of today', async () => {
    const task = taskTodoFixture({
      id: 'task-existing-weekly-repeat',
      title: 'Exercise',
      start_date: null,
      deadline: null,
    });
    const recurrence = {
      definition: taskRecurrenceDefinitionFixture({
        name: 'Exercise',
        next_occurrence_date: '2026-08-16',
      }),
      revision: taskRecurrenceRevisionFixture({
        name: 'Exercise',
        rule_mode: 'calendar',
        frequency: 'weekly',
        interval_count: 1,
        start_date: '2026-08-09',
        rule_config: { weekdays: [7] },
        deadline_offset_days: 6,
        deadline_after_start_days: 6,
        date_basis: 'deadline',
      }),
    };
    const { container, root } = renderDialog(task, recurrence, '2026-08-03');
    try {
      const preview = document.querySelector('[aria-label="Next Occurrences"]')!;
      expect(preview.querySelectorAll('li')).toHaveLength(3);
      expect(preview).toHaveTextContent('Start 2026 Aug 3');
      expect(preview).toHaveTextContent('Start 2026 Aug 10');
      expect(preview).toHaveTextContent('Start 2026 Aug 17');
      await act(async () => {
        document.querySelector<HTMLButtonElement>(
          `button[form="task-repeat-form-${task.id}"]`,
        )?.click();
        await Promise.resolve();
      });
      expect(edit).toHaveBeenCalledWith(expect.objectContaining({
        nextStartDate: '2026-08-03',
        dateBasis: 'deadline',
        deadlineAfterStartDays: 6,
      }));
    } finally {
      cleanup(root, container);
    }
  });
});
