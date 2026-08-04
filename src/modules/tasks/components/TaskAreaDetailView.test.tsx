import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import {
  taskAreaFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import { TaskAreaDetailView } from './TaskAreaDetailView';

const mockUseTaskAreaDetail = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskAreaDetail', () => ({
  useTaskAreaDetail: (...args: unknown[]) => mockUseTaskAreaDetail(...args),
}));

function hierarchy(): TaskHierarchyModel {
  return {
    areas: [taskAreaFixture({ id: 'area-a', title: 'Work' })],
    loading: false,
    error: null,
    updateArea: vi.fn().mockResolvedValue(undefined),
  } as unknown as TaskHierarchyModel;
}

function renderView(
  hierarchyModel: TaskHierarchyModel,
  onOpenTask = vi.fn(),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <MemoryRouter>
      <TaskAreaDetailView
        ownerId="owner-a"
        areaId="area-a"
        hierarchy={hierarchyModel}
        planningDate="2026-07-20"
        onOpenTask={onOpenTask}
      />
    </MemoryRouter>,
  ));
  return { container, root, onOpenTask };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('TaskAreaDetailView', () => {
  beforeEach(() => {
    mockUseTaskAreaDetail.mockReset().mockReturnValue({
      tasks: [taskTodoFixture({
        id: 'task-a',
        area_id: 'area-a',
        title: 'Wait for review',
        destination: 'anytime',
        start_date: '2026-07-21',
        actionability: 'waiting',
      })],
      loading: false,
      error: null,
    });
  });

  it('shows active Area work with real destination links', async () => {
    const hierarchyModel = hierarchy();
    const { container, root, onOpenTask } = renderView(hierarchyModel);

    try {
      expect(mockUseTaskAreaDetail).toHaveBeenCalledWith('owner-a', 'area-a');
      expect(container.querySelector('[data-task-compact-row]')).toHaveClass('h-16');
      expect(container.textContent).toContain('Upcoming / Waiting');

      const taskLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
        .find((link) => link.textContent?.includes('Wait for review'))!;
      expect(taskLink.getAttribute('href')).toBe('/upcoming');
      await act(async () => taskLink.click());
      expect(onOpenTask).toHaveBeenCalledWith('task-a', '/upcoming');

      expect(container.querySelector<HTMLAnchorElement>('a[href="/config"]')?.textContent)
        .toContain('Settings');
      expect(container.querySelector('[aria-label="Rename Work"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('reports a missing area instead of exposing another hierarchy', () => {
    const hierarchyModel = hierarchy();
    hierarchyModel.areas = [];
    const { container, root } = renderView(hierarchyModel);

    try {
      expect(container.textContent).toContain('Area Not Found');
      expect(container.querySelector('a[href="/upcoming"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the celebratory empty state when an Area has no loose tasks', () => {
    mockUseTaskAreaDetail.mockReturnValue({ tasks: [], loading: false, error: null });
    const { container, root } = renderView(hierarchy());

    try {
      const emptyState = container.querySelector<HTMLElement>('[data-task-empty-state]');
      expect(emptyState).toHaveTextContent('No loose tasks');
      expect(emptyState?.querySelector('svg.lucide-sparkles')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });
});
