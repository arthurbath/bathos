import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskChecklistItemFixture } from '@/modules/tasks/testing/taskFixtures';
import { TaskChecklistEditor } from './TaskChecklistEditor';

const mockUseTaskChecklist = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskChecklist', () => ({
  useTaskChecklist: (...args: unknown[]) => mockUseTaskChecklist(...args),
}));

const createItem = vi.fn();
const updateItem = vi.fn();
const setCompleted = vi.fn();
const deleteItem = vi.fn();
const reorderItem = vi.fn();

function checklistModel(items = [
  taskChecklistItemFixture(),
]) {
  return {
    items,
    loading: false,
    createItem,
    updateItem,
    setCompleted,
    deleteItem,
    reorderItem,
  };
}

function renderEditor(focusRequestTaskId?: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <TaskChecklistEditor
      ownerId="owner-a"
      taskId="task-a"
      focusRequestTaskId={focusRequestTaskId}
    />,
  ));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
    input,
    value,
  );
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TaskChecklistEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createItem.mockResolvedValue(taskChecklistItemFixture({ id: 'created-item' }));
    updateItem.mockResolvedValue(taskChecklistItemFixture());
    setCompleted.mockResolvedValue(taskChecklistItemFixture({ completed: true }));
    deleteItem.mockResolvedValue(undefined);
    reorderItem.mockResolvedValue(taskChecklistItemFixture());
    mockUseTaskChecklist.mockReturnValue(checklistModel());
  });

  it('focuses an existing checklist from the task command request', async () => {
    const { container, root } = renderEditor('task-draft');
    try {
      await act(async () => {
        document.dispatchEvent(new CustomEvent('bathos:task-checklist-focus', {
          detail: { taskId: 'task-draft' },
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      expect(document.activeElement).toBe(
        container.querySelector<HTMLInputElement>('input[aria-label="Checklist Item"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('creates a checklist from its empty state and commits the draft with Return', async () => {
    mockUseTaskChecklist.mockReturnValue(checklistModel([]));
    const { container, root } = renderEditor();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Add Checklist"]')?.click();
      });
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      await act(async () => {
        setInput(input, 'First step');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(createItem).toHaveBeenCalledWith('First step');
    } finally {
      cleanup(root, container);
    }
  });

  it('moves completion through the checklist model and keeps reopening position-neutral', async () => {
    const item = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    mockUseTaskChecklist.mockReturnValue(checklistModel([item]));
    const { container, root } = renderEditor();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Complete First step"]',
        )?.click();
      });
      expect(setCompleted).toHaveBeenCalledWith(item, true);
    } finally {
      cleanup(root, container);
    }
  });

  it('deletes an already-empty item with Backspace and removes empty rows on close', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[aria-label="Checklist Item"]',
    );
    await act(async () => setInput(inputs[1], ''));
    await act(async () => {
      inputs[1].dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
    });
    expect(deleteItem).toHaveBeenCalledWith('item-b');

    deleteItem.mockClear();
    await act(async () => setInput(inputs[0], ''));
    cleanup(root, container);
    expect(deleteItem).toHaveBeenCalledWith('item-a');
  });

  it('reorders with the checklist handle and accepts the final drop position', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const handle = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reorder First step"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => handle.dispatchEvent(dragStart));

      const end = container.querySelector<HTMLElement>('[data-checklist-drop-end]')!;
      const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(dragOver, 'dataTransfer', { value: dataTransfer });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        end.dispatchEvent(dragOver);
        end.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(reorderItem).toHaveBeenCalledWith('item-a', 1);
    } finally {
      cleanup(root, container);
    }
  });
});
