import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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
    loading: false,
    error: null,
    createArea: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue(undefined),
    updateArea: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(undefined),
    reorderArea: vi.fn().mockResolvedValue(undefined),
    reorderProject: vi.fn().mockResolvedValue(undefined),
    moveProjectToArea: vi.fn().mockResolvedValue(undefined),
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

      await act(async () => {
        areaInput.focus();
        setControlValue(areaInput, 'Health');
        areaInput.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(hierarchy.createArea).toHaveBeenCalledWith('Health');
      expect(document.activeElement).toBe(areaInput);

      await act(async () => {
        projectInput.focus();
        setControlValue(projectInput, 'Launch');
        setControlValue(projectArea, areaWork.id);
        projectInput.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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
