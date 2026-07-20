import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type { TaskChecklistItem, TaskTodo } from '@/modules/tasks/types/tasks';
import { TaskProjectDetailView } from './TaskProjectDetailView';

const mockUseTaskProjectDetail = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskProjectDetail', () => ({
  useTaskProjectDetail: (...args: unknown[]) => mockUseTaskProjectDetail(...args),
}));

const task = projectTask('task-a', 'Project task', null, 'a0');
const firstItem = checklistItem('item-a', 'Step one', 'a0');
const secondItem = checklistItem('item-b', 'Step two', 'a1');

function hierarchy(): TaskHierarchyModel {
  return {
    areas: [{ id: 'area-a', title: 'Work' }],
    projects: [{ id: 'project-a', title: 'Launch', area_id: 'area-a' }],
    headings: [{ id: 'heading-a', title: 'Next', project_id: 'project-a' }],
    loading: false,
    error: null,
    createArea: vi.fn(),
    createProject: vi.fn(),
    createHeading: vi.fn().mockResolvedValue(undefined),
    updateArea: vi.fn(),
    updateProject: vi.fn(),
    updateHeading: vi.fn().mockResolvedValue(undefined),
    reorderArea: vi.fn(),
    reorderProject: vi.fn(),
    reorderHeading: vi.fn().mockResolvedValue(undefined),
    moveProjectToArea: vi.fn(),
  } as unknown as TaskHierarchyModel;
}

function detail() {
  return {
    tasks: [task],
    checklistItems: [firstItem, secondItem],
    loading: false,
    error: null,
    createTask: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTaskToHeading: vi.fn().mockResolvedValue(undefined),
    reorderTask: vi.fn().mockResolvedValue(undefined),
    createChecklistItem: vi.fn().mockResolvedValue(undefined),
    updateChecklistItem: vi.fn().mockResolvedValue(undefined),
    completeChecklistItem: vi.fn().mockResolvedValue(undefined),
    reorderChecklistItem: vi.fn().mockResolvedValue(undefined),
  };
}

function renderDetail(hierarchyModel: TaskHierarchyModel) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <MemoryRouter>
      <TaskProjectDetailView
        ownerId="owner-a"
        projectId="project-a"
        hierarchy={hierarchyModel}
      />
    </MemoryRouter>,
  ));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function setControlValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value);
  control.dispatchEvent(new Event(
    control instanceof HTMLSelectElement ? 'change' : 'input',
    { bubbles: true },
  ));
}

describe('TaskProjectDetailView', () => {
  beforeEach(() => mockUseTaskProjectDetail.mockReset());

  it('creates headings and project tasks in an explicit heading', async () => {
    const hierarchyModel = hierarchy();
    const detailModel = detail();
    mockUseTaskProjectDetail.mockReturnValue(detailModel);
    const { container, root } = renderDetail(hierarchyModel);

    try {
      expect(container.textContent).toContain('Launch');
      expect(container.textContent).toContain('Work');
      expect(container.querySelector<HTMLAnchorElement>('a[href="/projects"]')).toBeTruthy();

      const headingInput = container.querySelector<HTMLInputElement>('[aria-label="New Heading Name"]')!;
      await act(async () => {
        setControlValue(headingInput, 'Later');
        headingInput.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(hierarchyModel.createHeading).toHaveBeenCalledWith('project-a', 'Later');

      const taskInput = container.querySelector<HTMLInputElement>(
        '[aria-label="New Project Task Name"]',
      )!;
      const headingSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="New Task Heading"]',
      )!;
      await act(async () => {
        setControlValue(taskInput, 'Draft copy');
        setControlValue(headingSelect, 'heading-a');
        taskInput.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(detailModel.createTask).toHaveBeenCalledWith('Draft copy', 'heading-a');
    } finally {
      cleanup(root, container);
    }
  });

  it('moves a task and edits its independent checklist', async () => {
    const hierarchyModel = hierarchy();
    const detailModel = detail();
    mockUseTaskProjectDetail.mockReturnValue(detailModel);
    const { container, root } = renderDetail(hierarchyModel);

    try {
      const taskHeading = container.querySelector<HTMLSelectElement>(
        '[aria-label="Heading for Project task"]',
      )!;
      await act(async () => setControlValue(taskHeading, 'heading-a'));
      expect(detailModel.moveTaskToHeading).toHaveBeenCalledWith('task-a', 'heading-a');

      const checklistInput = container.querySelector<HTMLInputElement>(
        '[aria-label="New Checklist Item for Project task"]',
      )!;
      await act(async () => {
        setControlValue(checklistInput, 'Final review');
        checklistInput.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(detailModel.createChecklistItem).toHaveBeenCalledWith('task-a', 'Final review');

      const complete = container.querySelector<HTMLInputElement>('[aria-label="Complete Step one"]')!;
      await act(async () => complete.click());
      expect(detailModel.completeChecklistItem).toHaveBeenCalledWith('item-a', true);

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Move Step two Up"]')?.click();
      });
      expect(detailModel.reorderChecklistItem).toHaveBeenCalledWith('item-b', 'up');
    } finally {
      cleanup(root, container);
    }
  });
});

function projectTask(
  id: string,
  title: string,
  headingId: string | null,
  hierarchyOrderKey: string,
): TaskTodo {
  return {
    id,
    owner_id: 'owner-a',
    area_id: null,
    project_id: 'project-a',
    heading_id: headingId,
    title,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    destination: 'anytime',
    today_section: 'daytime',
    order_key: 'a0',
    hierarchy_order_key: hierarchyOrderKey,
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    undo_source_event_id: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    revision: 1,
    client_mutation_id: `${id}-mutation`,
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  };
}

function checklistItem(id: string, title: string, orderKey: string): TaskChecklistItem {
  return {
    id,
    owner_id: 'owner-a',
    task_id: 'task-a',
    title,
    completed: false,
    completed_at: null,
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
