import { describe, expect, it, vi } from 'vitest';

import { TaskClipboardService } from './taskClipboardService';
import type { TaskClipboardSnapshot } from '@/modules/tasks/domain/taskClipboard';
import {
  taskChecklistItemFixture,
  taskRecurrenceDefinitionFixture,
  taskRecurrenceRevisionFixture,
  taskReminderFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const taskId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function dependencies() {
  return {
    database: {
      getAll: vi.fn(),
      getOptional: vi.fn(),
    },
    repository: {
      createTask: vi.fn(),
      transitionTask: vi.fn().mockResolvedValue(undefined),
    },
    hierarchyRepository: {
      createChecklistItem: vi.fn(),
      completeChecklistItem: vi.fn().mockResolvedValue(undefined),
    },
    reminderService: {
      save: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
    },
    recurrenceService: {
      save: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
      setStatus: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
    },
  };
}

const snapshot: TaskClipboardSnapshot = {
  title: 'First task',
  notes: 'Details',
  primaryLink: 'https://example.com',
  destination: 'anytime',
  todaySection: 'next',
  startDate: null,
  deadline: '2026-07-30',
  actionability: 'waiting',
  areaId: null,
  checklist: [],
  reminder: null,
  recurrence: null,
};

describe('TaskClipboardService', () => {
  it('loads deep user-authored task content in source order', async () => {
    const deps = dependencies();
    const task = taskTodoFixture({
      id: taskId,
      owner_id: ownerId,
      title: 'Deep task',
      recurrence_definition_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      recurrence_revision: 1,
      recurrence_occurrence_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      recurrence_logical_key: 'daily:2026-07-24',
    });
    const checklist = taskChecklistItemFixture({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      owner_id: ownerId,
      task_id: taskId,
      title: 'Checklist item',
      completed: true,
    });
    const reminder = taskReminderFixture({
      owner_id: ownerId,
      task_id: taskId,
      local_time: '14:30:00',
      time_zone: 'America/Los_Angeles',
    });
    deps.database.getAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tasks_todos')) return [task];
      if (sql.includes('FROM tasks_checklist_items')) return [checklist];
      if (sql.includes('FROM tasks_reminders')) return [reminder];
      return [];
    });
    deps.database.getOptional.mockImplementation(async (sql: string) => {
      if (sql.includes('tasks_recurrence_definitions')) {
        return taskRecurrenceDefinitionFixture({
          id: task.recurrence_definition_id!,
          owner_id: ownerId,
          name: 'Daily review',
        });
      }
      if (sql.includes('tasks_recurrence_revisions')) {
        return taskRecurrenceRevisionFixture({
          owner_id: ownerId,
          recurrence_id: task.recurrence_definition_id!,
          revision: 1,
        });
      }
      return null;
    });
    const service = new TaskClipboardService(
      deps.database as never,
      deps.repository as never,
      deps.hierarchyRepository as never,
      deps.reminderService as never,
      deps.recurrenceService as never,
      ownerId,
    );

    const result = await service.snapshot([task]);

    expect(result[0]).toMatchObject({
      title: 'Deep task',
      checklist: [{ title: 'Checklist item', completed: true }],
      reminder: {
        localTime: '14:30',
        timeZone: 'America/Los_Angeles',
      },
      recurrence: {
        name: 'Daily review',
        status: 'active',
        templateRevision: 1,
      },
    });
  });

  it('inserts Today tasks at the top in payload order and reconstructs children', async () => {
    const deps = dependencies();
    deps.database.getOptional.mockResolvedValueOnce({ order_key: 'a0' }).mockResolvedValue(null);
    let counter = 0;
    deps.repository.createTask.mockImplementation(async (input: Record<string, unknown>) => (
      taskTodoFixture({
        id: `00000000-0000-4000-8000-00000000000${counter += 1}`,
        owner_id: ownerId,
        title: String(input.title),
        destination: input.destination as 'anytime',
        today_section: input.todaySection as 'inbox',
        start_date: input.startDate as null,
        order_key: String(input.orderKey),
      })
    ));
    deps.hierarchyRepository.createChecklistItem.mockImplementation(async (
      input: Record<string, unknown>,
    ) => taskChecklistItemFixture({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      owner_id: ownerId,
      task_id: String(input.taskId),
      title: String(input.title),
    }));
    const withChildren: TaskClipboardSnapshot = {
      ...snapshot,
      checklist: [{ title: 'Check it', completed: true, orderKey: 'a0' }],
      reminder: {
        localTime: '23:00',
        timeZone: 'America/Los_Angeles',
        ambiguityChoice: 'earlier',
      },
      recurrence: {
        name: 'Daily review',
        status: 'active',
        templateId: '99999999-9999-4999-8999-999999999999',
        templateRevision: 1,
        ruleMode: 'calendar',
        frequency: 'daily',
        intervalCount: 1,
        startDate: '2026-07-25',
        planningTimeZone: 'America/Los_Angeles',
        missedPolicy: 'latest',
        catchUpLimit: 50,
        targetAreaId: null,
      },
    };
    const service = new TaskClipboardService(
      deps.database as never,
      deps.repository as never,
      deps.hierarchyRepository as never,
      deps.reminderService as never,
      deps.recurrenceService as never,
      ownerId,
    );

    const result = await service.reconstruct([
      withChildren,
      { ...snapshot, title: 'Second task' },
    ], {
      destination: { kind: 'today' },
      connected: true,
      planningDate: '2026-07-24',
      planningTimeZone: 'America/Los_Angeles',
      atTop: true,
    });

    expect(deps.repository.createTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: 'Second task', todaySection: 'inbox' }),
    );
    expect(deps.repository.createTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'First task', todaySection: 'inbox' }),
    );
    expect(result.map(({ title }) => title)).toEqual(['First task', 'Second task']);
    expect(deps.hierarchyRepository.completeChecklistItem).toHaveBeenCalled();
    expect(deps.reminderService.save).toHaveBeenCalled();
    expect(deps.recurrenceService.save).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Daily review',
      templateId: '99999999-9999-4999-8999-999999999999',
    }));
  });

  it('rejects connected-only content before creating roots', async () => {
    const deps = dependencies();
    const service = new TaskClipboardService(
      deps.database as never,
      deps.repository as never,
      deps.hierarchyRepository as never,
      deps.reminderService as never,
      deps.recurrenceService as never,
      ownerId,
    );
    await expect(service.reconstruct([{
      ...snapshot,
      reminder: {
        localTime: '14:00',
        timeZone: 'America/Los_Angeles',
        ambiguityChoice: 'earlier',
      },
    }], {
      destination: 'source',
      connected: false,
      planningDate: '2026-07-24',
      planningTimeZone: 'America/Los_Angeles',
      atTop: false,
    })).rejects.toThrow('connected task storage');
    expect(deps.repository.createTask).not.toHaveBeenCalled();
  });

  it('preserves an explicit null Today horizon when reconstructing into Anytime', async () => {
    const deps = dependencies();
    deps.database.getOptional.mockResolvedValue(null);
    deps.repository.createTask.mockImplementation(async (input: Record<string, unknown>) => (
      taskTodoFixture({
        owner_id: ownerId,
        title: String(input.title),
        destination: input.destination as 'anytime',
        today_section: input.todaySection as null,
        start_date: input.startDate as null,
      })
    ));
    const service = new TaskClipboardService(
      deps.database as never,
      deps.repository as never,
      deps.hierarchyRepository as never,
      deps.reminderService as never,
      deps.recurrenceService as never,
      ownerId,
    );

    await service.reconstruct([snapshot], {
      destination: { kind: 'anytime' },
      connected: true,
      planningDate: '2026-07-24',
      planningTimeZone: 'America/Los_Angeles',
      atTop: true,
    });

    expect(deps.repository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      destination: 'anytime',
      todaySection: null,
      startDate: null,
    }));
  });

  it('recoverably deletes created roots after a child reconstruction failure', async () => {
    const deps = dependencies();
    const created = taskTodoFixture({ id: taskId, owner_id: ownerId });
    deps.repository.createTask.mockResolvedValue(created);
    deps.hierarchyRepository.createChecklistItem.mockRejectedValue(new Error('child failed'));
    const service = new TaskClipboardService(
      deps.database as never,
      deps.repository as never,
      deps.hierarchyRepository as never,
      deps.reminderService as never,
      deps.recurrenceService as never,
      ownerId,
    );

    await expect(service.reconstruct([{
      ...snapshot,
      checklist: [{ title: 'Child', completed: false, orderKey: 'a0' }],
    }], {
      destination: 'source',
      connected: true,
      planningDate: '2026-07-24',
      planningTimeZone: 'America/Los_Angeles',
      atTop: false,
    })).rejects.toThrow('child failed');
    expect(deps.repository.transitionTask).toHaveBeenCalledWith(ownerId, taskId, 'delete');
  });
});
