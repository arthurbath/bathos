import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { taskAreaFixture, taskProjectFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskArea, TaskProject } from '@/modules/tasks/types/tasks';
import { TaskProjectsView } from './TaskProjectsView';

const areaWork = hierarchyArea('area-work', 'Work', 'a0');
const areaPersonal = hierarchyArea('area-personal', 'Personal', 'a1');
const projectAlpha = hierarchyProject('project-alpha', 'Alpha', 'a0', areaWork.id);
const projectBeta = hierarchyProject('project-beta', 'Beta', 'a1', areaWork.id);
const projectLoose = hierarchyProject('project-loose', 'Loose', 'a0', null);

function defaultHierarchy() {
  return {
    areas: [areaWork, areaPersonal],
    projects: [projectAlpha, projectBeta, projectLoose],
    headings: [],
    loading: false,
    error: null,
    createArea: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue(undefined),
    createHeading: vi.fn().mockResolvedValue(undefined),
    updateArea: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(undefined),
    updateHeading: vi.fn().mockResolvedValue(undefined),
    reorderArea: vi.fn().mockResolvedValue(undefined),
    reorderProject: vi.fn().mockResolvedValue(undefined),
    reorderHeading: vi.fn().mockResolvedValue(undefined),
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
      <TaskProjectsView hierarchy={hierarchy} />
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

describe('TaskProjectsView', () => {
  it('creates areas and projects from separate keyboard-friendly forms', async () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      const areaInput = container.querySelector<HTMLInputElement>('[aria-label="New Area Name"]')!;
      const projectInput = container.querySelector<HTMLInputElement>('[aria-label="New Project Name"]')!;
      const projectArea = container.querySelector<HTMLSelectElement>('[aria-label="New Project Area"]')!;
      expect(container.querySelector<HTMLAnchorElement>('[aria-label="Open Alpha"]')
        ?.getAttribute('href')).toBe('/projects/project-alpha');
      expect(container.querySelector<HTMLAnchorElement>('[aria-label="Open Work Area"]')
        ?.getAttribute('href')).toBe('/areas/area-work');

      await act(async () => {
        areaInput.focus();
        setControlValue(areaInput, 'Health');
        pressEnter(areaInput, true);
      });
      expect(hierarchy.createArea).not.toHaveBeenCalled();

      await act(async () => {
        pressEnter(areaInput);
      });
      expect(hierarchy.createArea).toHaveBeenCalledWith('Health');
      expect(document.activeElement).toBe(areaInput);

      await act(async () => {
        projectInput.focus();
        setControlValue(projectInput, 'Launch');
        setControlValue(projectArea, areaWork.id);
        pressEnter(projectInput);
      });
      expect(hierarchy.createProject).toHaveBeenCalledWith('Launch', areaWork.id);
      expect(document.activeElement).toBe(projectInput);
    } finally {
      cleanup(root, container);
    }
  });

  it('renames an area and restores focus to its title control', async () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      const titleButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Work')!;
      await act(async () => titleButton.click());

      const input = container.querySelector<HTMLInputElement>('[aria-label="Rename Work"]')!;
      expect(document.activeElement).toBe(input);
      await act(async () => {
        setControlValue(input, 'Workplace');
        input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(hierarchy.updateArea).toHaveBeenCalledWith(areaWork.id, { title: 'Workplace' });
      const restoredButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Work');
      expect(document.activeElement).toBe(restoredButton);
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
        container.querySelector<HTMLButtonElement>('[aria-label="Move Personal Up"]')?.click();
      });
      expect(hierarchy.reorderProject).toHaveBeenCalledWith(projectBeta.id, 'up');
      expect(hierarchy.reorderArea).toHaveBeenCalledWith(areaPersonal.id, 'up');
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
