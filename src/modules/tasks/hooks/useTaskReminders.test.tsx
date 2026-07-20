import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskReminderFixture } from '@/modules/tasks/testing/taskFixtures';
import { useTaskReminders } from './useTaskReminders';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTasksRuntime: vi.fn(),
  useTaskWebPush: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

vi.mock('@/modules/tasks/hooks/useTaskWebPush', () => ({
  useTaskWebPush: (...args: unknown[]) => mocks.useTaskWebPush(...args),
}));

const planningTimeZone = 'America/Los_Angeles';
const dueReminder = {
  delivery_id: 'delivery-a',
  occurrence_id: 'occurrence-a',
  reminder_id: 'reminder-a',
  root_type: 'todo' as const,
  root_id: 'task-a',
  title: 'Review Schedule',
  resolved_at: '2026-07-20T16:00:00.000Z',
  attempt_count: 1,
};

describe('useTaskReminders', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    mocks.useQuery.mockReset().mockReturnValue({
      data: [taskReminderFixture()],
      isLoading: false,
      error: null,
    });
    mocks.useTaskWebPush.mockReset().mockReturnValue({ state: 'unsupported' });
  });

  it('claims due reminders in a visible connected client and acknowledges them', async () => {
    const reminderService = {
      claimDue: vi.fn().mockResolvedValue({
        outcome: 'accepted',
        through_at: '2026-07-20T16:00:00.000Z',
        items: [dueReminder],
      }),
      save: vi.fn(),
      cancel: vi.fn(),
      acknowledge: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      reminderService,
    });
    const { result } = renderHook(() => useTaskReminders('owner-a'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(reminderService.claimDue).toHaveBeenCalledTimes(1);
    expect(result.current.dueItems).toEqual([dueReminder]);
    expect(result.current.byRootId.get('task-a')).toEqual(taskReminderFixture());

    await act(async () => {
      await result.current.acknowledge(dueReminder.delivery_id);
    });
    expect(reminderService.acknowledge).toHaveBeenCalledWith(dueReminder.delivery_id);
    expect(result.current.dueItems).toEqual([]);
  });

  it('defaults reminder saves to the owner planning time zone and overlays the result', async () => {
    const saved = taskReminderFixture({
      id: 'reminder-b',
      task_id: 'task-b',
      client_mutation_id: 'mutation-reminder-b',
    });
    const reminderService = {
      claimDue: vi.fn().mockResolvedValue({
        outcome: 'accepted',
        through_at: '2026-07-20T16:00:00.000Z',
        items: [],
      }),
      save: vi.fn().mockResolvedValue({ outcome: 'accepted', reminder: saved }),
      cancel: vi.fn(),
      acknowledge: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      reminderService,
    });
    const { result } = renderHook(() => useTaskReminders('owner-a'));

    await act(async () => {
      await result.current.save({
        rootType: 'todo',
        rootId: 'task-b',
        localDate: '2026-07-20',
        localTime: '09:00',
      });
    });

    expect(reminderService.save).toHaveBeenCalledWith(expect.objectContaining({
      rootId: 'task-b',
      timeZone: planningTimeZone,
    }));
    expect(result.current.byRootId.get('task-b')).toEqual(saved);
  });

  it('exposes a content-free due-claim failure until an explicit retry succeeds', async () => {
    const reminderService = {
      claimDue: vi.fn()
        .mockRejectedValueOnce(new Error('provider detail'))
        .mockResolvedValue({
          outcome: 'accepted',
          through_at: '2026-07-20T16:00:00.000Z',
          items: [],
        }),
      save: vi.fn(),
      cancel: vi.fn(),
      acknowledge: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      reminderService,
    });
    const { result } = renderHook(() => useTaskReminders('owner-a'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.claimError).toBeInstanceOf(Error);

    await act(async () => {
      await result.current.claimDue();
    });
    expect(reminderService.claimDue).toHaveBeenCalledTimes(2);
    expect(result.current.claimError).toBeNull();
  });

  it('does not claim or mutate reminders in local-only mode', async () => {
    const reminderService = {
      claimDue: vi.fn(),
      save: vi.fn(),
      cancel: vi.fn(),
      acknowledge: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local',
      planningTimeZone,
      reminderService,
    });
    const { result } = renderHook(() => useTaskReminders('owner-a'));

    await act(async () => {
      await result.current.claimDue();
    });
    await expect(result.current.save({
      rootType: 'todo',
      rootId: 'task-a',
      localDate: '2026-07-20',
      localTime: '09:00',
    })).rejects.toThrow('Reminder changes require connected task storage');
    expect(reminderService.claimDue).not.toHaveBeenCalled();
    expect(reminderService.save).not.toHaveBeenCalled();
  });
});
