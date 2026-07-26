import React from 'react';
import { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { taskAreaFixture, taskProjectFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskArea, TaskProject } from '@/modules/tasks/types/tasks';
import { useBathosFormInteractions } from '@/platform/hooks/useCommandEnterSubmit';
import { TaskProjectsView } from './TaskProjectsView';

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { configurable: true, value: () => false },
  setPointerCapture: { configurable: true, value: () => undefined },
  releasePointerCapture: { configurable: true, value: () => undefined },
  scrollIntoView: { configurable: true, value: () => undefined },
});

const areaWork = hierarchyArea('area-work', 'Work', 'a0');
const areaPersonal = hierarchyArea('area-personal', 'Personal', 'a1');
const projectAlpha = hierarchyProject('project-alpha', 'Alpha', 'a0', areaWork.id);
const projectBeta = hierarchyProject('project-beta', 'Beta', 'a1', areaWork.id);
const projectLoose = hierarchyProject('project-loose', 'Loose', 'a0', null);

function defaultHierarchy() {
  return {
    areas: [areaWork, areaPersonal],
    projects: [projectAlpha, projectBeta, projectLoose],
    loading: false,
    error: null,
    createArea: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue(undefined),
    updateArea: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(undefined),
    reorderArea: vi.fn().mockResolvedValue(undefined),
    reorderProject: vi.fn().mockResolvedValue(undefined),
    moveProjectToArea: vi.fn().mockResolvedValue(undefined),
    moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
    reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
    transitionProject: vi.fn().mockResolvedValue(undefined),
    deleteHierarchy: vi.fn().mockResolvedValue(undefined),
  };
}

function renderView(hierarchy: ReturnType<typeof defaultHierarchy>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <MemoryRouter>
      <TestFormInteractions />
      <TaskProjectsView hierarchy={hierarchy} />
    </MemoryRouter>,
  ));
  return { container, root };
}

function TestFormInteractions() {
  useBathosFormInteractions();
  return null;
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

describe('TaskProjectsView', () => {
  it('creates projects from a focused keyboard-friendly dialog', async () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      expect(container.querySelector('#new-task-project-title')).toBeNull();
      expect(container.querySelector('[aria-label="Add Area"]')).toBeNull();
      expect(container.querySelector<HTMLAnchorElement>('[aria-label="Open Alpha"]')
        ?.getAttribute('href')).toBe('/projects/project-alpha');
      expect(container.querySelector('[aria-label="Open Work Area"]')).toBeNull();
      expect(container.querySelector('#task-area-area-personal')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Add Project"]')?.click();
      });
      const projectInput = document.querySelector<HTMLInputElement>('#new-task-project-title')!;
      await act(async () => {
        setControlValue(projectInput, 'Launch');
      });
      const projectArea = screen.getByRole('combobox', { name: 'Area' });
      projectArea.focus();
      await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');
      await act(async () => pressEnter(projectInput));
      expect(hierarchy.createProject).toHaveBeenCalledWith('Launch', areaWork.id);
      await act(async () => new Promise<void>((resolve) => window.setTimeout(resolve, 0)));
      expect(document.activeElement).toBe(
        container.querySelector<HTMLButtonElement>('[aria-label="Add Project"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('cancels creation without mutation and exposes named icon controls', async () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      const addProject = container.querySelector<HTMLButtonElement>('[aria-label="Add Project"]')!;
      expect(addProject.textContent).toBe('');
      expect(container.querySelector('[aria-label="Add Area"]')).toBeNull();

      await act(async () => addProject.click());
      const projectInput = document.querySelector<HTMLInputElement>('#new-task-project-title')!;
      fireEvent.input(projectInput, { target: { value: 'Discard Me' } });
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(hierarchy.createProject).not.toHaveBeenCalled();
      await act(async () => new Promise<void>((resolve) => window.setTimeout(resolve, 0)));
      expect(document.activeElement).toBe(addProject);
      expect(document.querySelector('#new-task-project-title')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('presents Area headings without exposing Area administration', () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      expect(container.querySelector('#task-area-area-work')?.textContent).toBe('Work');
      expect(container.querySelector('[aria-label="Rename Work"]')).toBeNull();
      expect(container.querySelector('[aria-label="Move Work Up"]')).toBeNull();
      expect(container.querySelector('[aria-label="Move Work Down"]')).toBeNull();
      expect(container.querySelector('[aria-label="Delete Work"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('moves and reorders projects only within their structural hierarchy', async () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      const areaSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Area for Alpha"]',
      )!;
      await act(async () => setControlValue(areaSelect, areaPersonal.id));
      expect(hierarchy.moveProjectToArea).toHaveBeenCalledWith(projectAlpha.id, areaPersonal.id);

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Move Beta Up"]')?.click();
      });
      expect(hierarchy.reorderProject).toHaveBeenCalledWith(projectBeta.id, 'up');
      expect(hierarchy.reorderArea).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });
});

function hierarchyArea(id: string, title: string, orderKey: string): TaskArea {
  return taskAreaFixture({
    id,
    title,
    order_key: orderKey,
    client_mutation_id: `${id}-mutation`,
  });
}

function hierarchyProject(
  id: string,
  title: string,
  orderKey: string,
  areaId: string | null,
): TaskProject {
  return taskProjectFixture({
    id,
    area_id: areaId,
    title,
    order_key: orderKey,
    planning_order_key: orderKey,
    client_mutation_id: `${id}-mutation`,
  });
}
