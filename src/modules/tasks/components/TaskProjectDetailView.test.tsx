import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { taskChecklistItemFixture, taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskChecklistItem, TaskTodo } from '@/modules/tasks/types/tasks';
import { TaskProjectDetailView } from './TaskProjectDetailView';

const mockUseTaskProjectDetail = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskProjectDetail', () => ({
  useTaskProjectDetail: (...args: unknown[]) => mockUseTaskProjectDetail(...args),
}));

const task = projectTask('task-a', 'Project task', 'a0');
const firstItem = checklistItem('item-a', 'Step one', 'a0');
const secondItem = checklistItem('item-b', 'Step two', 'a1');

function hierarchy(): TaskHierarchyModel {
  return {
    areas: [{ id: 'area-a', title: 'Work' }],
    projects: [{
      id: 'project-a',
      title: 'Launch',
      area_id: 'area-a',
      lifecycle: 'open',
      destination: 'anytime',
      today_section: 'next',
      start_date: '2026-07-24',
      deadline: '2026-07-25',
    }],
    loading: false,
    error: null,
    createArea: vi.fn(),
    createProject: vi.fn(),
    updateArea: vi.fn(),
    updateProject: vi.fn(),
    reorderArea: vi.fn(),
    reorderProject: vi.fn(),
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
    reorderTask: vi.fn().mockResolvedValue(undefined),
    createChecklistItem: vi.fn().mockResolvedValue(undefined),
    updateChecklistItem: vi.fn().mockResolvedValue(undefined),
    completeChecklistItem: vi.fn().mockResolvedValue(undefined),
    reorderChecklistItem: vi.fn().mockResolvedValue(undefined),
    deleteChecklistItem: vi.fn().mockResolvedValue(undefined),
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
        planningDate="2026-07-20"
        reminder={null}
        reminderMode="connected"
        reminderTimeZone="America/Los_Angeles"
        onSaveReminder={vi.fn().mockResolvedValue(undefined)}
        onCancelReminder={vi.fn().mockResolvedValue(undefined)}
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

function pressEnter(control: HTMLInputElement, isComposing = false) {
  control.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    isComposing,
    key: 'Enter',
  }));
}

describe('TaskProjectDetailView', () => {
  beforeEach(() => mockUseTaskProjectDetail.mockReset());

  it('gives project identity and lifecycle actions separate narrow-mobile rows', () => {
    const hierarchyModel = hierarchy();
    hierarchyModel.projects[0] = {
      ...hierarchyModel.projects[0],
      title: 'Mobile Acceptance Project',
    };
    mockUseTaskProjectDetail.mockReturnValue(detail());
    const { container, root } = renderDetail(hierarchyModel);

    try {
      const title = Array.from(container.querySelectorAll('h3'))
        .find((heading) => heading.textContent === 'Mobile Acceptance Project');
      const complete = Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Complete');

      expect(title?.parentElement?.className).toContain('w-full');
      expect(title?.parentElement?.className).toContain('sm:flex-1');
      expect(complete?.parentElement?.className).toContain('w-full');
      expect(complete?.parentElement?.className).toContain('sm:w-auto');
    } finally {
      cleanup(root, container);
    }
  });

  it('creates project tasks without exposing headings', async () => {
    const hierarchyModel = hierarchy();
    const detailModel = detail();
    mockUseTaskProjectDetail.mockReturnValue(detailModel);
    const { container, root } = renderDetail(hierarchyModel);

    try {
      expect(container.textContent).toContain('Launch');
      expect(container.textContent).toContain('Work');
      expect(container.querySelector<HTMLAnchorElement>('a[href="/projects"]')).toBeTruthy();

      const taskInput = container.querySelector<HTMLInputElement>(
        '[aria-label="New Project Task Name"]',
      )!;
      await act(async () => {
        setControlValue(taskInput, 'Draft copy');
        pressEnter(taskInput);
      });
      expect(detailModel.createTask).toHaveBeenCalledWith('Draft copy');
      expect(container.textContent).not.toContain('Heading');
    } finally {
      cleanup(root, container);
    }
  });

  it('edits task actionability and its independent checklist', async () => {
    const hierarchyModel = hierarchy();
    const detailModel = detail();
    mockUseTaskProjectDetail.mockReturnValue(detailModel);
    const { container, root } = renderDetail(hierarchyModel);

    try {
      const actionability = container.querySelector<HTMLSelectElement>(
        '[aria-label="Actionability for Project task"]',
      )!;
      await act(async () => setControlValue(actionability, 'waiting'));
      expect(detailModel.updateTask).toHaveBeenCalledWith('task-a', {
        actionability: 'waiting',
      });

      const checklistInput = container.querySelector<HTMLInputElement>(
        '[aria-label="New Checklist Item for Project task"]',
      )!;
      await act(async () => {
        setControlValue(checklistInput, 'Final review');
        pressEnter(checklistInput);
      });
      expect(detailModel.createChecklistItem).toHaveBeenCalledWith('task-a', 'Final review');

      const complete = container.querySelector<HTMLInputElement>('[aria-label="Complete Step one"]')!;
      await act(async () => complete.click());
      expect(detailModel.completeChecklistItem).toHaveBeenCalledWith('item-a', true);

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Move Step two Up"]')?.click();
      });
      expect(detailModel.reorderChecklistItem).toHaveBeenCalledWith('item-b', 'up');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Delete Step one"]')?.click();
      });
      expect(detailModel.deleteChecklistItem).toHaveBeenCalledWith('item-a');
    } finally {
      cleanup(root, container);
    }
  });

  it('presents project task file provenance without making the audited source editable', () => {
    const hierarchyModel = hierarchy();
    const detailModel = detail();
    detailModel.tasks = [{
      ...task,
      source_kind: 'file',
      source_url: 'file:///Users/Shared/Synthetic.txt',
      source_title: 'Synthetic.txt',
    }];
    mockUseTaskProjectDetail.mockReturnValue(detailModel);
    const { container, root } = renderDetail(hierarchyModel);

    try {
      const indicator = container.querySelector<HTMLElement>(
        '[aria-label="File Source for Project task"]',
      );
      expect(indicator?.tagName).toBe('SPAN');
      expect(indicator?.title).toBe('File: Synthetic.txt');
    } finally {
      cleanup(root, container);
    }
  });

  it('edits project planning and clears availability when moved to Someday', async () => {
    const hierarchyModel = hierarchy();
    mockUseTaskProjectDetail.mockReturnValue(detail());
    const { container, root } = renderDetail(hierarchyModel);

    try {
      const destination = container.querySelector<HTMLSelectElement>(
        '#project-destination-project-a',
      )!;
      await act(async () => setControlValue(destination, 'someday'));
      expect(container.querySelector<HTMLButtonElement>('[aria-label="Project Start Date"]')
        ?.hasAttribute('disabled')).toBe(true);

      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent?.trim() === 'Save Planning')
          ?.click();
      });
      expect(hierarchyModel.updateProject).toHaveBeenCalledWith('project-a', {
        destination: 'someday',
        today_section: null,
        start_date: null,
        deadline: '2026-07-25',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('retains a selected day horizon on a future-start project', async () => {
    const hierarchyModel = hierarchy();
    mockUseTaskProjectDetail.mockReturnValue(detail());
    const { container, root } = renderDetail(hierarchyModel);

    try {
      const dayHorizon = container.querySelector<HTMLSelectElement>(
        '#project-today-section-project-a',
      )!;
      expect(dayHorizon.disabled).toBe(false);
      await act(async () => setControlValue(dayHorizon, 'inbox'));
      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent?.trim() === 'Save Planning')
          ?.click();
      });
      expect(hierarchyModel.updateProject).toHaveBeenCalledWith('project-a', {
        destination: 'anytime',
        today_section: 'inbox',
        start_date: '2026-07-24',
        deadline: '2026-07-25',
      });
    } finally {
      cleanup(root, container);
    }
  });
});

function projectTask(
  id: string,
  title: string,
  hierarchyOrderKey: string,
): TaskTodo {
  return taskTodoFixture({
    id,
    project_id: 'project-a',
    title,
    destination: 'anytime',
    hierarchy_order_key: hierarchyOrderKey,
    client_mutation_id: `${id}-mutation`,
  });
}

function checklistItem(id: string, title: string, orderKey: string): TaskChecklistItem {
  return taskChecklistItemFixture({
    id,
    task_id: 'task-a',
    title,
    order_key: orderKey,
    client_mutation_id: `${id}-mutation`,
  });
}
