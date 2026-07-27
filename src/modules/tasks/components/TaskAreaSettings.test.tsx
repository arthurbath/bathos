import React from 'react';
import { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { taskAreaFixture } from '@/modules/tasks/testing/taskFixtures';
import { useBathosFormInteractions } from '@/platform/hooks/useCommandEnterSubmit';
import { TaskAreaSettings } from './TaskAreaSettings';

const areaWork = taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' });
const areaPersonal = taskAreaFixture({ id: 'area-personal', title: 'Personal', order_key: 'a1' });

function hierarchy(): TaskHierarchyModel {
  return {
    areas: [areaWork, areaPersonal],
    loading: false,
    error: null,
    createArea: vi.fn().mockResolvedValue(undefined),
    updateArea: vi.fn().mockResolvedValue(undefined),
    reorderArea: vi.fn().mockResolvedValue(undefined),
    deleteHierarchy: vi.fn().mockResolvedValue(undefined),
  } as unknown as TaskHierarchyModel;
}

function renderSettings(model: TaskHierarchyModel) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <>
      <TestFormInteractions />
      <TaskAreaSettings hierarchy={model} />
    </>,
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

describe('TaskAreaSettings', () => {
  it('adds and renames Areas from Config', async () => {
    const model = hierarchy();
    const { container, root } = renderSettings(model);

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Add Area"]')?.click();
      });
      const areaInput = document.querySelector<HTMLInputElement>('#new-task-area-title')!;
      fireEvent.input(areaInput, { target: { value: 'Health' } });
      fireEvent.submit(areaInput.closest('form')!);
      expect(model.createArea).toHaveBeenCalledWith('Health');

      const workButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Work')!;
      await userEvent.click(workButton);
      const renameInput = screen.getByRole('textbox', { name: 'Rename Work' });
      fireEvent.change(renameInput, { target: { value: 'Professional' } });
      fireEvent.submit(renameInput.closest('form')!);
      expect(model.updateArea).toHaveBeenCalledWith('area-work', { title: 'Professional' });
    } finally {
      cleanup(root, container);
    }
  });

  it('reorders Areas and confirms recoverable deletion', async () => {
    const model = hierarchy();
    const { container, root } = renderSettings(model);

    try {
      await userEvent.click(screen.getByRole('button', { name: 'Move Personal Up' }));
      expect(model.reorderArea).toHaveBeenCalledWith('area-personal', 'up');

      await userEvent.click(screen.getByRole('button', { name: 'Delete Work' }));
      expect(screen.getByRole('alertdialog', { name: 'Delete Area' })).toBeTruthy();
      expect(screen.getByText(
        'Work, its tasks, and checklist items will move to Done together.',
      )).toBeTruthy();
      expect(model.deleteHierarchy).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Move to Done' }));
      expect(model.deleteHierarchy).toHaveBeenCalledWith('area', 'area-work');
      expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });
});
