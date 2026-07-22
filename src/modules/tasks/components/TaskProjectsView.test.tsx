import React from 'react';
import { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { taskAreaFixture, taskProjectFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskArea, TaskProject } from '@/modules/tasks/types/tasks';
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
  it('creates areas and projects from focused keyboard-friendly dialogs', async () => {
    const hierarchy = defaultHierarchy();
    const { container, root } = renderView(hierarchy);

    try {
      expect(container.querySelector('#new-task-area-title')).toBeNull();
      expect(container.querySelector('#new-task-project-title')).toBeNull();
      expect(container.querySelector<HTMLAnchorElement>('[aria-label="Open Alpha"]')
        ?.getAttribute('href')).toBe('/projects/project-alpha');
      expect(container.querySelector<HTMLAnchorElement>('[aria-label="Open Work Area"]')
        ?.getAttribute('href')).toBe('/areas/area-work');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Add Area"]')?.click();
      });
      const areaInput = document.querySelector<HTMLInputElement>('#new-task-area-title')!;
      expect(screen.getByRole('dialog', { name: 'Add Area' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      await act(async () => {
        setControlValue(areaInput, 'Health');
        pressEnter(areaInput, true);
      });
      expect(hierarchy.createArea).not.toHaveBeenCalled();

      await act(async () => {
        pressEnter(areaInput);
      });
      expect(hierarchy.createArea).toHaveBeenCalledWith('Health');
      await act(async () => new Promise<void>((resolve) => window.setTimeout(resolve, 0)));
      expect(document.activeElement).toBe(
        container.querySelector<HTMLButtonElement>('[aria-label="Add Area"]'),
      );

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
      const addArea = container.querySelector<HTMLButtonElement>('[aria-label="Add Area"]')!;
      const addProject = container.querySelector<HTMLButtonElement>('[aria-label="Add Project"]')!;
      expect(addArea.textContent).toBe('');
      expect(addProject.textContent).toBe('');

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
