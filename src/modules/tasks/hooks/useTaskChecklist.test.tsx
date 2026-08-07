import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskChecklistItemFixture } from '@/modules/tasks/testing/taskFixtures';
import {
  TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
  type TaskChecklistForwardMutationDetail,
} from './taskChecklistForwardMutationEvents';
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

describe('useTaskChecklist', () => {
  const createChecklistItem = vi.fn();
  const updateChecklistItem = vi.fn();
  const request = vi.fn();
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
        createChecklistItem,
        updateChecklistItem,
      },
      hierarchyOperationsRepository: { request },
    });
  });

  it('announces the exact accepted action for insertion, editing, completion, deletion, and reorder', async () => {
    const forwarded: TaskChecklistForwardMutationDetail[] = [];
    const handleForwardMutation = (event: Event) => {
      forwarded.push((event as CustomEvent<TaskChecklistForwardMutationDetail>).detail);
    };
    globalThis.addEventListener(
      TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
      handleForwardMutation,
    );
    createChecklistItem.mockImplementation(async ({
      operationId,
      occurredAt,
      orderKey,
      title,
    }) => taskChecklistItemFixture({
      id: 'created-item',
      title,
      order_key: orderKey,
      last_operation_id: operationId,
      updated_at: occurredAt,
    }));
    updateChecklistItem.mockImplementation(async (
      _ownerId: string,
      itemId: string,
      patch: Partial<ReturnType<typeof taskChecklistItemFixture>>,
      context: { operationId: string; occurredAt: string },
    ) => ({
      ...queryItems.find(({ id }) => id === itemId)!,
      ...patch,
      last_operation_id: context.operationId,
      updated_at: context.occurredAt,
      revision: 2,
      client_mutation_id: `saved-${itemId}-${context.operationId}`,
    }));
    request.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));

    try {
      await act(async () => {
        await result.current.createItem('Inserted');
        await result.current.updateItem('item-a', { title: 'Edited' });
        await result.current.setCompleted(
          result.current.items.find(({ id }) => id === 'item-b')!,
          true,
        );
        await result.current.deleteItem('item-c');
        await result.current.reorderItems(['item-a'], 2);
      });

      expect(forwarded).toHaveLength(5);
      expect(new Set(forwarded.map(({ actionId }) => actionId)).size).toBe(5);
      expect(forwarded).toEqual(forwarded.map((detail) => ({
        schemaVersion: 1,
        actionId: expect.any(String),
        occurredAt: expect.any(String),
        settled: expect.any(Promise),
      })));
      const changes = await Promise.all(forwarded.map(({ settled }) => settled));
      expect(changes[2]).toEqual([expect.objectContaining({
        entityType: 'checklist_item',
        entityId: 'item-b',
        before: expect.objectContaining({ completed: false, order_key: 'a1' }),
        after: expect.objectContaining({ completed: true }),
      })]);
      expect(createChecklistItem.mock.calls[0][0].operationId).toBe(forwarded[0].actionId);
      expect(updateChecklistItem.mock.calls[0][3].operationId).toBe(forwarded[1].actionId);
      expect(updateChecklistItem.mock.calls[1][3].operationId).toBe(forwarded[2].actionId);
      expect(request.mock.calls[0][0].context.operationId).toBe(forwarded[3].actionId);
      expect(updateChecklistItem.mock.calls.at(-1)?.[3].operationId)
        .toBe(forwarded[4].actionId);
    } finally {
      globalThis.removeEventListener(
        TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
        handleForwardMutation,
      );
      unmount();
    }
  });

  it('adds an item inside a checklist whose rows use legacy numeric ranks', async () => {
    queryItems = queryItems.map((item, index) => ({
      ...item,
      order_key: String((index + 1) * 1024).padStart(12, '0'),
    }));
    createChecklistItem.mockImplementation(async ({
      title,
      orderKey,
    }: {
      title: string;
      orderKey: string;
    }) => taskChecklistItemFixture({
      id: 'created-legacy-item',
      title,
      order_key: orderKey,
    }));
    const { result } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));

    await act(async () => {
      await result.current.createItem('Inserted item', 1);
    });

    const input = createChecklistItem.mock.calls[0]?.[0];
    expect(input.orderKey > '000000001024').toBe(true);
    expect(input.orderKey < '000000002048').toBe(true);
    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-a',
      'created-legacy-item',
      'item-b',
      'item-c',
    ]);
  });

  it('shows the completed state and final order before persistence resolves', async () => {
    const forwarded: TaskChecklistForwardMutationDetail[] = [];
    const handleForwardMutation = (event: Event) => {
      forwarded.push((event as CustomEvent<TaskChecklistForwardMutationDetail>).detail);
    };
    globalThis.addEventListener(
      TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
      handleForwardMutation,
    );
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
    expect(forwarded).toHaveLength(1);

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

    await expect(forwarded[0].settled).resolves.toEqual([
      expect.objectContaining({
        entityType: 'checklist_item',
        entityId: 'item-a',
        before: expect.objectContaining({ completed: false, order_key: 'a0' }),
        after: expect.objectContaining({ completed: true }),
      }),
    ]);
    globalThis.removeEventListener(
      TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
      handleForwardMutation,
    );

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
    expect(result.current.items.at(-1)?.client_mutation_id).toBe('saved-completion');
  });

  it('completes, sinks, and reopens an item whose checklist uses legacy numeric ranks', async () => {
    queryItems = queryItems.map((item, index) => ({
      ...item,
      order_key: String((index + 1) * 1024).padStart(12, '0'),
    }));
    updateChecklistItem.mockImplementation(async (
      _ownerId: string,
      itemId: string,
      patch: Partial<ReturnType<typeof taskChecklistItemFixture>>,
    ) => ({
      ...queryItems.find(({ id }) => id === itemId)!,
      ...patch,
      revision: 2,
      client_mutation_id: 'saved-legacy-completion',
    }));
    const { result } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));

    await act(async () => {
      await result.current.setCompleted(result.current.items[0], true);
    });

    expect(result.current.items.at(-1)).toMatchObject({
      id: 'item-a',
      completed: true,
    });
    expect(updateChecklistItem).toHaveBeenCalledWith(
      'owner-a',
      'item-a',
      expect.objectContaining({
        order_key: expect.any(String),
      }),
      expect.any(Object),
    );

    await act(async () => {
      await result.current.setCompleted(result.current.items.at(-1)!, false);
    });

    expect(result.current.items.find(({ id }) => id === 'item-a')?.completed).toBe(false);
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

  it('keeps a dropped checklist item in its new position after persistence resolves', async () => {
    updateChecklistItem.mockImplementation(async (
      _ownerId: string,
      itemId: string,
      patch: { order_key?: string },
    ) => {
      const current = queryItems.find(({ id }) => id === itemId)!;
      return {
        ...current,
        ...patch,
        revision: current.revision + 1,
        client_mutation_id: `saved-reorder-${itemId}`,
      };
    });
    const { result, rerender } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));
    let reorder: Promise<ReturnType<typeof taskChecklistItemFixture>[]>;

    act(() => {
      reorder = result.current.reorderItems(['item-a'], 3);
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);

    let saved: ReturnType<typeof taskChecklistItemFixture>[] = [];
    await act(async () => {
      saved = await reorder;
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);

    queryItems = queryItems.map((item) => (
      saved.find(({ id }) => id === item.id) ?? item
    ));
    rerender();

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
  });

  it('reorders an item whose checklist uses legacy numeric ranks', async () => {
    queryItems = queryItems.map((item, index) => ({
      ...item,
      order_key: String((index + 1) * 1024).padStart(12, '0'),
    }));
    updateChecklistItem.mockImplementation(async (
      _ownerId: string,
      itemId: string,
      patch: Partial<ReturnType<typeof taskChecklistItemFixture>>,
    ) => ({
      ...queryItems.find(({ id }) => id === itemId)!,
      ...patch,
      revision: 2,
      client_mutation_id: 'saved-legacy-reorder',
    }));
    const { result } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));

    await act(async () => {
      await result.current.reorderItems(['item-a'], 3);
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
  });

  it('does not let an earlier item save overwrite a later reorder', async () => {
    let resolveTitleSave: (
      item: ReturnType<typeof taskChecklistItemFixture>,
    ) => void = () => undefined;
    let resolveReorderSave: (
      item: ReturnType<typeof taskChecklistItemFixture>,
    ) => void = () => undefined;
    updateChecklistItem
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveTitleSave = resolve;
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveReorderSave = resolve;
      }));
    const { result } = renderHook(() => useTaskChecklist('owner-a', 'task-a'));
    let titleSave: Promise<ReturnType<typeof taskChecklistItemFixture>>;
    let reorder: Promise<ReturnType<typeof taskChecklistItemFixture>[]>;

    act(() => {
      titleSave = result.current.updateItem('item-a', { title: 'Edited title' });
    });
    act(() => {
      reorder = result.current.reorderItems(['item-a'], 3);
    });

    const projected = result.current.items.at(-1)!;
    expect(projected.id).toBe('item-a');

    await act(async () => {
      resolveReorderSave({
        ...projected,
        revision: 2,
        client_mutation_id: 'saved-reorder-item-a',
      });
      await reorder;
    });
    expect(result.current.items.at(-1)?.id).toBe('item-a');

    await act(async () => {
      resolveTitleSave({
        ...queryItems[0],
        title: 'Edited title',
        revision: 2,
        client_mutation_id: 'saved-title-item-a',
      });
      await titleSave;
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-c',
      'item-a',
    ]);
  });
});
