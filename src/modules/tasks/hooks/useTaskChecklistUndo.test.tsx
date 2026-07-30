import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskChecklistItemFixture } from '@/modules/tasks/testing/taskFixtures';
import { useTaskChecklistUndo } from './useTaskChecklistUndo';

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

let latest: ReturnType<typeof useTaskChecklistUndo>;

function Harness() {
  latest = useTaskChecklistUndo('owner-a');
  return null;
}

function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness />));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function historyEvent({
  id = 'event-a',
  actionId = `action-${id}`,
  transition = 'update',
  before = taskChecklistItemFixture({
    title: 'First title',
    order_key: 'a0',
    revision: 1,
  }),
  after = taskChecklistItemFixture({
    title: 'Second title',
    order_key: 'a1',
    revision: 2,
  }),
}: {
  id?: string;
  actionId?: string;
  transition?: 'create' | 'update' | 'delete' | 'restore';
  before?: ReturnType<typeof taskChecklistItemFixture> | null;
  after?: ReturnType<typeof taskChecklistItemFixture>;
} = {}) {
  return {
    id,
    owner_id: 'owner-a',
    operation_id: null,
    action_id: actionId,
    entity_type: 'checklist_item',
    entity_id: after?.id ?? before?.id ?? 'checklist-a',
    transition,
    actor_type: 'user',
    mutation_channel: 'web',
    client_mutation_id: `mutation-${id}`,
    affected_ids: [after?.id ?? before?.id ?? 'checklist-a'],
    base_revision: before?.revision ?? 0,
    result_revision: after?.revision ?? (before?.revision ?? 0) + 1,
    before_state: before,
    after_state: after,
    occurred_at: '2026-07-27T01:00:00.000Z',
  };
}

describe('useTaskChecklistUndo', () => {
  const updateChecklistItem = vi.fn();
  const request = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    updateChecklistItem.mockResolvedValue(taskChecklistItemFixture());
    request.mockResolvedValue(undefined);
    mocks.useTasksRuntime.mockReturnValue({
      hierarchyRepository: { updateChecklistItem },
      hierarchyOperationsRepository: { request },
    });
  });

  it('undoes and redoes checklist content, completion, and exact ordering', async () => {
    const before = taskChecklistItemFixture({
      title: 'Unfinished',
      completed: false,
      completed_at: null,
      order_key: 'a0',
      revision: 1,
    });
    const after = taskChecklistItemFixture({
      title: 'Finished',
      completed: true,
      completed_at: '2026-07-27T01:00:00.000Z',
      order_key: 'z0',
      revision: 2,
    });
    mocks.useQuery.mockReturnValue({
      data: [historyEvent({ before, after })],
      isLoading: false,
      error: null,
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.undo();
      });
      expect(updateChecklistItem).toHaveBeenLastCalledWith(
        'owner-a',
        after.id,
        {
          title: before.title,
          completed: false,
          completed_at: null,
          order_key: before.order_key,
        },
        {
          occurredAt: expect.any(String),
          operationId: expect.any(String),
        },
      );

      await act(async () => {
        await latest.redo();
      });
      expect(updateChecklistItem).toHaveBeenLastCalledWith(
        'owner-a',
        after.id,
        {
          title: after.title,
          completed: true,
          completed_at: after.completed_at,
          order_key: after.order_key,
        },
        {
          occurredAt: expect.any(String),
          operationId: expect.any(String),
        },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('undoes checklist creation by deleting it and redoes it by restoring it', async () => {
    const created = taskChecklistItemFixture({ revision: 1 });
    mocks.useQuery.mockReturnValue({
      data: [historyEvent({
        transition: 'create',
        before: null,
        after: created,
      })],
      isLoading: false,
      error: null,
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.undo();
      });
      expect(request).toHaveBeenLastCalledWith({
        ownerId: 'owner-a',
        rootType: 'checklist_item',
        rootId: created.id,
        operation: 'delete',
        descendantPolicy: 'reject',
        context: {
          occurredAt: expect.any(String),
          operationId: expect.any(String),
        },
      });

      await act(async () => {
        await latest.redo();
      });
      expect(request).toHaveBeenLastCalledWith({
        ownerId: 'owner-a',
        rootType: 'checklist_item',
        rootId: created.id,
        operation: 'restore',
        descendantPolicy: 'reject',
        context: {
          occurredAt: expect.any(String),
          operationId: expect.any(String),
        },
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('treats one multi-item gesture timestamp as one undo and redo step', async () => {
    const firstBefore = taskChecklistItemFixture({
      id: 'checklist-a',
      task_id: 'task-a',
      title: 'First',
      order_key: 'a0',
      revision: 1,
    });
    const firstAfter = taskChecklistItemFixture({
      ...firstBefore,
      title: 'First moved',
      order_key: 'z0',
      revision: 2,
    });
    const secondBefore = taskChecklistItemFixture({
      id: 'checklist-b',
      task_id: 'task-a',
      title: 'Second',
      order_key: 'a1',
      revision: 1,
    });
    const secondAfter = taskChecklistItemFixture({
      ...secondBefore,
      title: 'Second moved',
      order_key: 'z1',
      revision: 2,
    });
    mocks.useQuery.mockReturnValue({
      data: [
        historyEvent({
          id: 'event-a',
          actionId: 'action-group',
          before: firstBefore,
          after: firstAfter,
        }),
        historyEvent({
          id: 'event-b',
          actionId: 'action-group',
          before: secondBefore,
          after: secondAfter,
        }),
      ],
      isLoading: false,
      error: null,
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.undo();
      });
      expect(updateChecklistItem).toHaveBeenCalledTimes(2);
      expect(updateChecklistItem.mock.calls.map((call) => call[1])).toEqual([
        'checklist-b',
        'checklist-a',
      ]);

      await act(async () => {
        await latest.redo();
      });
      expect(updateChecklistItem.mock.calls.slice(2).map((call) => call[1])).toEqual([
        'checklist-a',
        'checklist-b',
      ]);
    } finally {
      cleanup(root, container);
    }
  });

  it('undoes and redoes a recoverable checklist deletion', async () => {
    const before = taskChecklistItemFixture({ revision: 2 });
    const after = taskChecklistItemFixture({
      revision: 3,
      disposition: 'deleted',
      deleted_at: '2026-07-27T01:00:00.000Z',
      deletion_root_id: 'checklist-a',
    });
    mocks.useQuery.mockReturnValue({
      data: [historyEvent({
        transition: 'delete',
        before,
        after,
      })],
      isLoading: false,
      error: null,
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.undo();
      });
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        operation: 'restore',
        rootId: before.id,
      }));

      await act(async () => {
        await latest.redo();
      });
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        operation: 'delete',
        rootId: before.id,
      }));
    } finally {
      cleanup(root, container);
    }
  });
});
