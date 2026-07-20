import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { taskReminderFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskReminderAvailability } from './taskReminderAvailability';
import { TaskProjectReminderForm } from './TaskProjectReminderForm';

const reminder = taskReminderFixture({
  root_type: 'project',
  task_id: null,
  project_id: 'project-a',
});

function renderForm({
  mode = 'connected',
  onSave = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn().mockResolvedValue(undefined),
}: {
  mode?: TaskReminderAvailability;
  onSave?: ReturnType<typeof vi.fn>;
  onCancel?: ReturnType<typeof vi.fn>;
} = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <TaskProjectReminderForm
      projectId="project-a"
      reminder={reminder}
      mode={mode}
      timeZone="America/Los_Angeles"
      onSave={onSave}
      onCancel={onCancel}
    />,
  ));
  return { container, root, onSave, onCancel };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TaskProjectReminderForm', () => {
  it('saves and cancels a project-root reminder through explicit form actions', async () => {
    const { container, root, onSave, onCancel } = renderForm();

    try {
      const time = container.querySelector<HTMLInputElement>('#project-reminder-time-project-a')!;
      await act(async () => setInputValue(time, '10:30'));
      const save = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Save Reminder')!;
      await act(async () => save.click());
      expect(onSave).toHaveBeenCalledWith({
        localDate: '2026-07-20',
        localTime: '10:30',
        ambiguityChoice: 'earlier',
      });

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Clear Project Reminder"]')
          ?.click();
      });
      await act(async () => save.click());
      expect(onCancel).toHaveBeenCalledOnce();
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps project reminder mutation unavailable in local-only mode', () => {
    const { container, root } = renderForm({ mode: 'local' });

    try {
      expect(container.textContent).toContain('Reminders require connected task storage');
      const save = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Save Reminder');
      expect(save?.disabled).toBe(true);
      expect(container.querySelector<HTMLButtonElement>('[aria-label="Project Reminder Date"]')
        ?.disabled).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('protects an existing schedule when the reminder projection is unavailable', () => {
    const { container, root } = renderForm({ mode: 'unavailable' });
    try {
      expect(container.textContent).toContain('Editing is disabled to protect existing schedules');
      expect(container.textContent).not.toContain('provider detail');
      const save = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Save Reminder');
      expect(save?.disabled).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });
});
