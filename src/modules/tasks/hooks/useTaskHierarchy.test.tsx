import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskArea, TaskProject } from '@/modules/tasks/types/tasks';
import { useTaskHierarchy } from './useTaskHierarchy';

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

const work = hierarchyArea('area-work', 'Work', 'a0');
const personal = hierarchyArea('area-personal', 'Personal', 'a1');
const alpha = hierarchyProject('project-alpha', 'Alpha', 'a0', work.id);
const beta = hierarchyProject('project-beta', 'Beta', 'a1', work.id);
const loose = hierarchyProject('project-loose', 'Loose', 'a0', null);

let latest: ReturnType<typeof useTaskHierarchy>;
let areaRows: TaskArea[];
let projectRows: TaskProject[];

function Harness() {
  latest = useTaskHierarchy('owner-a');
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

describe('useTaskHierarchy', () => {
  beforeEach(() => {
    areaRows = [personal, work];
    projectRows = [beta, loose, alpha];
    mocks.useQuery.mockReset().mockImplementation((query: string) => ({
      data: query.includes('tasks_areas') ? areaRows : projectRows,
      isLoading: false,
      error: null,
    }));
  });

  it('sorts structural peers independently and keeps a created area visible optimistically', async () => {
    const created = hierarchyArea('area-health', 'Health', 'a2');
    const hierarchyRepository = {
      createArea: vi.fn().mockResolvedValue(created),
      createProject: vi.fn(),
      updateArea: vi.fn(),
      updateProject: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ hierarchyRepository });
    const { container, root } = renderHarness();

    try {
      expect(latest.areas.map(({ id }) => id)).toEqual([work.id, personal.id]);
      expect(latest.projects.map(({ id }) => id)).toEqual([alpha.id, loose.id, beta.id]);

      await act(async () => {
        await latest.createArea('Health');
      });
      expect(hierarchyRepository.createArea).toHaveBeenCalledWith({
        ownerId: 'owner-a',
        title: 'Health',
      });
      expect(latest.areas.map(({ id }) => id)).toEqual([work.id, personal.id, created.id]);
    } finally {
      cleanup(root, container);
    }
  });

  it('reorders a project among area peers without changing planning order', async () => {
    const hierarchyRepository = {
      createArea: vi.fn(),
      createProject: vi.fn(),
      updateArea: vi.fn(),
      updateProject: vi.fn().mockImplementation(
        async (_ownerId: string, projectId: string, patch: Partial<TaskProject>) => ({
          ...projectRows.find(({ id }) => id === projectId)!,
          ...patch,
          revision: 2,
          client_mutation_id: `${projectId}-reordered`,
        }),
      ),
    };
    mocks.useTasksRuntime.mockReturnValue({ hierarchyRepository });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.reorderProject(beta.id, 'up');
      });
      const patch = hierarchyRepository.updateProject.mock.calls[0][2];
      expect(hierarchyRepository.updateProject).toHaveBeenCalledWith(
        'owner-a',
        beta.id,
        expect.objectContaining({ order_key: expect.any(String) }),
      );
      expect(patch).not.toHaveProperty('planning_order_key');
      expect(patch.order_key < alpha.order_key).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('moves a project to the tail of its new area scope', async () => {
    const hierarchyRepository = {
      createArea: vi.fn(),
      createProject: vi.fn(),
      updateArea: vi.fn(),
      updateProject: vi.fn().mockImplementation(
        async (_ownerId: string, projectId: string, patch: Partial<TaskProject>) => ({
          ...projectRows.find(({ id }) => id === projectId)!,
          ...patch,
          revision: 2,
          client_mutation_id: `${projectId}-moved`,
        }),
      ),
    };
    mocks.useTasksRuntime.mockReturnValue({ hierarchyRepository });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.moveProjectToArea(alpha.id, null);
      });
      const patch = hierarchyRepository.updateProject.mock.calls[0][2];
      expect(patch.area_id).toBeNull();
      expect(patch.order_key > loose.order_key).toBe(true);
      expect(patch).not.toHaveProperty('planning_order_key');
    } finally {
      cleanup(root, container);
    }
  });
});

function hierarchyArea(id: string, title: string, orderKey: string): TaskArea {
  return {
    id,
    owner_id: 'owner-a',
    title,
    order_key: orderKey,
    disposition: 'present',
    deleted_at: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: `${id}-mutation`,
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  };
}

function hierarchyProject(
  id: string,
  title: string,
  orderKey: string,
  areaId: string | null,
): TaskProject {
  return {
    id,
    owner_id: 'owner-a',
    area_id: areaId,
    title,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    destination: 'anytime',
    today_section: 'daytime',
    order_key: orderKey,
    planning_order_key: orderKey,
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: `${id}-mutation`,
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  };
}
