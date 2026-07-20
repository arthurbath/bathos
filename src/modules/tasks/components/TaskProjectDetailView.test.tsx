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

const task = projectTask('task-a', 'Project task', null, 'a0');
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
      today_section: 'daytime',
      start_date: '2026-07-24',
      deadline: '2026-07-25',
    }],
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
        planningDate="2026-07-20"
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
        pressEnter(headingInput, true);
      });
      expect(hierarchyModel.createHeading).not.toHaveBeenCalled();
      await act(async () => {
        pressEnter(headingInput);
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
        pressEnter(taskInput);
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
        today_section: 'daytime',
        start_date: null,
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
  headingId: string | null,
  hierarchyOrderKey: string,
): TaskTodo {
  return taskTodoFixture({
    id,
    project_id: 'project-a',
    heading_id: headingId,
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
