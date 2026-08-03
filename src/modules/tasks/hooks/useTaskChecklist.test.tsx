import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskChecklistItemFixture } from '@/modules/tasks/testing/taskFixtures';
import { useTaskChecklist } from './useTaskChecklist';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

describe('useTaskChecklist completion', () => {
  const updateChecklistItem = vi.fn();
  let queryItems: ReturnType<typeof taskChecklistItemFixture>[];

  beforeEach(() => {
    vi.clearAllMocks();
    queryItems = [
      taskChecklistItemFixture({
        id: 'item-a',
        title: 'First open item',
        completed: false,
        order_key: 'a0',
        revision: 1,
      }),
      taskChecklistItemFixture({
        id: 'item-b',
        title: 'Second open item',
        completed: false,
        order_key: 'a1',
        revision: 1,
      }),
      taskChecklistItemFixture({
        id: 'item-c',
        title: 'Existing completed item',
        completed: true,
        completed_at: '2026-08-01T12:00:00.000Z',
        order_key: 'a2',
        revision: 2,
      }),
    ];
    mocks.useQuery.mockImplementation(() => ({
      data: queryItems,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({
      hierarchyRepository: {
        createChecklistItem: vi.fn(),
        updateChecklistItem,
      },
      hierarchyOperationsRepository: { request: vi.fn() },
    });
  });

  it('shows the completed state and final order before persistence resolves', async () => {
    let resolveUpdate: (
      item: ReturnType<typeof taskChecklistItemFixture>,
    ) => void = () => undefined;
    updateChecklistItem.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const { result } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));
    let completion: Promise<ReturnType<typeof taskChecklistItemFixture>>;

    act(() => {
      completion = result.current.setCompleted(result.current.items[0], true);
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
    expect(result.current.items.at(-1)).toMatchObject({
      id: 'item-a',
      completed: true,
      completed_at: expect.any(String),
      client_mutation_id: expect.stringContaining('optimistic-checklist-completion-'),
    });

    const projected = result.current.items.at(-1)!;
    const saved = {
      ...projected,
      revision: 2,
      client_mutation_id: 'saved-completion',
    };
    await act(async () => {
      resolveUpdate(saved);
      await completion;
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
    expect(result.current.items.at(-1)?.client_mutation_id).toBe('saved-completion');
  });

  it('keeps the optimistic order stable when the query updates before persistence resolves', async () => {
    let resolveUpdate: (
      item: ReturnType<typeof taskChecklistItemFixture>,
    ) => void = () => undefined;
    updateChecklistItem.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const { result, rerender } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));
    let completion: Promise<ReturnType<typeof taskChecklistItemFixture>>;

    act(() => {
      completion = result.current.setCompleted(result.current.items[0], true);
    });
    const projected = result.current.items.at(-1)!;
    queryItems = [result.current.items[0], result.current.items[1], {
      ...projected,
      client_mutation_id: 'saved-completion',
    }];
    rerender();

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
    expect(result.current.items.at(-1)?.client_mutation_id).toBe(
      projected.client_mutation_id,
    );

    await act(async () => {
      resolveUpdate(queryItems[2]);
      await completion;
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
  });

  it('restores the prior completion state and order when persistence fails', async () => {
    let rejectUpdate: (error: Error) => void = () => undefined;
    updateChecklistItem.mockReturnValue(new Promise((_, reject) => {
      rejectUpdate = reject;
    }));
    const { result } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));
    let completion: Promise<ReturnType<typeof taskChecklistItemFixture>>;

    act(() => {
      completion = result.current.setCompleted(result.current.items[0], true);
    });
    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);

    await act(async () => {
      rejectUpdate(new Error('Completion rejected'));
      await expect(completion).rejects.toThrow('Completion rejected');
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-a',
      'item-b',
      'item-c',
    ]);
    expect(result.current.items[0].completed).toBe(false);
  });
});
