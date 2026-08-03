import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { waitFor } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  serializeTaskChecklistClipboard,
  TASK_CHECKLIST_CLIPBOARD_KIND,
} from '@/modules/tasks/domain/taskChecklistClipboard';
import { taskChecklistItemFixture } from '@/modules/tasks/testing/taskFixtures';
import { TaskChecklistEditor } from './TaskChecklistEditor';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
const mockUseTaskChecklist = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: mockToast,
}));

vi.mock('@/modules/tasks/hooks/useTaskChecklist', () => ({
  useTaskChecklist: (...args: unknown[]) => mockUseTaskChecklist(...args),
}));

const createItem = vi.fn();
const createItems = vi.fn();
const createItemCopies = vi.fn();
const updateItem = vi.fn();
const setCompleted = vi.fn();
const deleteItem = vi.fn();
const deleteItems = vi.fn();
const reorderItem = vi.fn();
const reorderItems = vi.fn();

function checklistModel(items = [
  taskChecklistItemFixture(),
]) {
  return {
    items,
    loading: false,
    createItem,
    createItems,
    createItemCopies,
    updateItem,
    setCompleted,
    deleteItem,
    deleteItems,
    reorderItem,
    reorderItems,
  };
}

function renderEditor(
  focusRequestTaskId?: string,
  {
    emptyActionLayout,
    onContentPresenceChange,
    onRegisterFlush,
  }: {
    emptyActionLayout?: 'paired' | 'standalone';
    onContentPresenceChange?: (present: boolean) => void;
    onRegisterFlush?: (flush: (() => Promise<void>) | null) => void;
  } = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <TaskChecklistEditor
      ownerId="owner-a"
      taskId="task-a"
      focusRequestTaskId={focusRequestTaskId}
      emptyActionLayout={emptyActionLayout}
      onContentPresenceChange={onContentPresenceChange}
      onRegisterFlush={onRegisterFlush}
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

function pasteEvent(text: string, html = ''): ClipboardEvent {
  const event = new Event('paste', {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: {
      getData: vi.fn((type: string) => (type === 'text/html' ? html : text)),
      types: html ? ['text/plain', 'text/html'] : ['text/plain'],
    },
  });
  return event;
}

function clipboardWriteEvent(type: 'copy' | 'cut') {
  const setData = vi.fn();
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: { setData },
  });
  return { event, setData };
}

function waitForAnimationFrames(count = 3): Promise<void> {
  return new Promise((resolve) => {
    const advance = (remaining: number) => {
      if (remaining === 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => advance(remaining - 1));
    };
    advance(count);
  });
}

describe('TaskChecklistEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createItem.mockResolvedValue(taskChecklistItemFixture({ id: 'created-item' }));
    createItems.mockResolvedValue([]);
    createItemCopies.mockResolvedValue([]);
    updateItem.mockResolvedValue(taskChecklistItemFixture());
    setCompleted.mockResolvedValue(taskChecklistItemFixture({ completed: true }));
    deleteItem.mockResolvedValue(undefined);
    deleteItems.mockResolvedValue(undefined);
    reorderItem.mockResolvedValue(taskChecklistItemFixture());
    reorderItems.mockResolvedValue([]);
    mockUseTaskChecklist.mockReturnValue(checklistModel());
  });

  it('reports loaded checklist content to its task editor', () => {
    const onContentPresenceChange = vi.fn();
    const { container, root } = renderEditor(undefined, { onContentPresenceChange });

    try {
      expect(onContentPresenceChange).toHaveBeenLastCalledWith(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('centers the empty checklist disclosure in paired layout and reports a draft', () => {
    mockUseTaskChecklist.mockReturnValue(checklistModel([]));
    const onContentPresenceChange = vi.fn();
    const { container, root } = renderEditor(undefined, {
      emptyActionLayout: 'paired',
      onContentPresenceChange,
    });

    try {
      const addChecklist = container.querySelector<HTMLButtonElement>(
        '[data-task-checklist-disclosure]',
      );
      expect(addChecklist).toHaveClass('w-full', 'justify-center');
      expect(onContentPresenceChange).toHaveBeenLastCalledWith(false);

      act(() => addChecklist?.click());

      expect(onContentPresenceChange).toHaveBeenLastCalledWith(true);
      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('inserts and focuses a shortcut draft before the first completed item', async () => {
    const completed = taskChecklistItemFixture({
      id: 'item-completed',
      title: 'Completed step',
      completed: true,
      order_key: 'a2',
    });
    const unchecked = taskChecklistItemFixture({
      id: 'item-first',
      title: 'Unchecked step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([
      unchecked,
      completed,
    ]));
    const { container, root } = renderEditor('task-draft');
    try {
      await act(async () => {
        document.dispatchEvent(new CustomEvent('bathos:task-checklist-focus', {
          detail: { taskId: 'task-draft' },
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      expect([...rows].map((row) => row.dataset.checklistItemId)).toEqual([
        'item-first',
        'draft',
        'item-completed',
      ]);
      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(document.activeElement).toBe(draft);
      expect(draft.selectionStart).toBe(0);
    } finally {
      cleanup(root, container);
    }
  });

  it('appends and focuses a shortcut draft when no items are completed', async () => {
    const first = taskChecklistItemFixture({
      id: 'item-first',
      title: 'First step',
      order_key: 'a1',
    });
    const second = taskChecklistItemFixture({
      id: 'item-second',
      title: 'Second step',
      order_key: 'a2',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor('task-draft');
    try {
      await act(async () => {
        document.dispatchEvent(new CustomEvent('bathos:task-checklist-focus', {
          detail: { taskId: 'task-draft' },
        }));
        await waitForAnimationFrames();
      });
      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      expect([...rows].map((row) => row.dataset.checklistItemId)).toEqual([
        'item-first',
        'item-second',
        'draft',
      ]);
      expect(document.activeElement).toBe(draft);
      expect(draft.selectionStart).toBe(0);
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the Item placeholder for existing and new checklist inputs', async () => {
    const { container, root } = renderEditor();
    try {
      const existing = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      expect(existing.placeholder).toBe('Item');

      await act(async () => {
        existing.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(draft.placeholder).toBe('Item');
      expect(document.activeElement).toBe(draft);
      expect(draft.selectionStart).toBe(0);
    } finally {
      cleanup(root, container);
    }
  });

  it('removes a blank checklist draft as soon as focus leaves it', async () => {
    const item = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    mockUseTaskChecklist.mockReturnValue(checklistModel([item]));
    const { container, root } = renderEditor();
    try {
      const existing = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      act(() => {
        existing.focus();
        existing.setSelectionRange(existing.value.length, existing.value.length);
      });
      await act(async () => {
        existing.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      act(() => setInput(draft, '   '));
      expect(draft.value).toBe('   ');
      expect(document.activeElement).toBe(draft);

      act(() => existing.focus());

      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeNull();
      expect(createItem).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('pastes rich multiline text into a persisted item as adjacent checklist items', async () => {
    const item = taskChecklistItemFixture({
      id: 'item-existing',
      title: 'Prefix selected suffix',
    });
    createItems.mockResolvedValue([
      taskChecklistItemFixture({ id: 'item-middle', title: 'Middle' }),
      taskChecklistItemFixture({ id: 'item-final', title: 'Last suffix' }),
    ]);
    mockUseTaskChecklist.mockReturnValue(checklistModel([item]));
    const { container, root } = renderEditor();

    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      input.setSelectionRange(7, 15);
      const paste = pasteEvent(
        'First\r\nMiddle\rLast',
        '<p>First</p><p>Middle</p><p>Last</p>',
      );

      await act(async () => {
        input.dispatchEvent(paste);
        await Promise.resolve();
      });

      expect(paste.defaultPrevented).toBe(true);
      expect(updateItem).toHaveBeenCalledWith(
        item.id,
        { title: 'Prefix First' },
        {
          occurredAt: expect.any(String),
          operationId: expect.any(String),
        },
      );
      expect(createItems).toHaveBeenCalledWith(
        ['Middle', 'Last suffix'],
        1,
        {
          occurredAt: expect.any(String),
          operationId: expect.any(String),
        },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('pastes multiline text into a draft and focuses the final line at the pasted boundary', async () => {
    mockUseTaskChecklist.mockReturnValue(checklistModel([]));
    const created = [
      taskChecklistItemFixture({ id: 'item-first', title: 'First' }),
      taskChecklistItemFixture({ id: 'item-middle', title: 'Middle' }),
    ];
    createItems.mockResolvedValue(created);
    const { container, root } = renderEditor();

    try {
      act(() => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-checklist-disclosure]',
        )?.click();
      });
      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      setInput(draft, 'Prefix suffix');
      draft.setSelectionRange(7, 7);
      const paste = pasteEvent('First\nMiddle\nLast');

      await act(async () => {
        draft.dispatchEvent(paste);
        await Promise.resolve();
      });
      await waitFor(() => expect(createItems).toHaveBeenCalled());
      await act(async () => {
        await Promise.resolve();
      });
      mockUseTaskChecklist.mockReturnValue(checklistModel(created));
      await act(async () => {
        root.render(
          <TaskChecklistEditor ownerId="owner-a" taskId="task-a" />,
        );
        await waitForAnimationFrames();
      });

      const focusedDraft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(paste.defaultPrevented).toBe(true);
      expect(createItems).toHaveBeenCalledWith(
        ['Prefix First', 'Middle'],
        0,
        { occurredAt: expect.any(String) },
      );
      expect(focusedDraft.value).toBe('Lastsuffix');
      expect(document.activeElement).toBe(focusedDraft);
      expect(focusedDraft.selectionStart).toBe(4);
    } finally {
      cleanup(root, container);
    }
  });

  it('leaves a single-line checklist paste to the native input', () => {
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const paste = pasteEvent(' one line');
      input.dispatchEvent(paste);

      expect(paste.defaultPrevented).toBe(false);
      expect(createItems).not.toHaveBeenCalled();
      expect(updateItem).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps open and completed checklist boxes neutral without a green hover state', () => {
    mockUseTaskChecklist.mockReturnValue(checklistModel([
      taskChecklistItemFixture({
        id: 'item-open',
        title: 'Open Step',
        completed: false,
        order_key: 'a0',
      }),
      taskChecklistItemFixture({
        id: 'item-completed',
        title: 'Completed Step',
        completed: true,
        order_key: 'a1',
      }),
    ]));
    const { container, root } = renderEditor();

    try {
      const openControl = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Open Step"]',
      );
      const completedControl = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reopen Completed Step"]',
      );
      expect(openControl).toHaveClass('text-muted-foreground');
      expect(completedControl).toHaveClass('text-muted-foreground');
      expect(openControl?.className).not.toContain('hover:');
      expect(completedControl?.className).not.toContain('hover:');
      expect(completedControl?.querySelector('svg.lucide-square-check'))
        .not.toHaveClass('text-success');
    } finally {
      cleanup(root, container);
    }
  });

  it('animates one exact checklist reorder transaction when an item is completed', async () => {
    let modelItems = [
      taskChecklistItemFixture({
        id: 'item-a',
        title: 'First open item',
        completed: false,
        order_key: 'a0',
      }),
      taskChecklistItemFixture({
        id: 'item-b',
        title: 'Second open item',
        completed: false,
        order_key: 'a1',
      }),
      taskChecklistItemFixture({
        id: 'item-c',
        title: 'Existing completed item',
        completed: true,
        order_key: 'a2',
      }),
    ];
    let rowTops: Record<string, number> = {
      'item-a': 0,
      'item-b': 40,
      'item-c': 80,
    };
    mockUseTaskChecklist.mockImplementation(() => checklistModel(modelItems));
    setCompleted.mockImplementation(async (item, completed) => {
      const completedItem = {
        ...item,
        completed,
        completed_at: '2026-08-02T12:00:00.000Z',
        order_key: 'z0',
      };
      modelItems = [modelItems[1], modelItems[2], completedItem];
      rowTops = {
        'item-b': 0,
        'item-c': 40,
        'item-a': 80,
      };
      return completedItem;
    });
    const { container, root } = renderEditor();

    try {
      const animateById = new Map<string, ReturnType<typeof vi.fn>>();
      for (const row of container.querySelectorAll<HTMLElement>('[data-checklist-item-id]')) {
        const id = row.dataset.checklistItemId!;
        const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
        animateById.set(id, animate);
        Object.defineProperty(row, 'getBoundingClientRect', {
          configurable: true,
          value: vi.fn(() => ({ top: rowTops[id] } as DOMRect)),
        });
        Object.defineProperty(row, 'animate', {
          configurable: true,
          value: animate,
        });
      }
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete First open item"]',
      )!;

      await act(async () => {
        complete.click();
        root.render(<TaskChecklistEditor ownerId="owner-a" taskId="task-a" />);
        await Promise.resolve();
      });

      expect(setCompleted).toHaveBeenCalledTimes(1);
      expect(animateById.get('item-a')).toHaveBeenCalledWith(
        [
          { transform: 'translateY(-80px)' },
          { transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
      expect(animateById.get('item-b')).toHaveBeenCalledWith(
        [
          { transform: 'translateY(40px)' },
          { transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
      expect(animateById.get('item-c')).toHaveBeenCalledTimes(1);

      modelItems = [...modelItems];
      await act(async () => {
        root.render(<TaskChecklistEditor ownerId="owner-a" taskId="task-a" />);
        await Promise.resolve();
      });

      expect(animateById.get('item-a')).toHaveBeenCalledTimes(1);
      expect(animateById.get('item-b')).toHaveBeenCalledTimes(1);
      expect(animateById.get('item-c')).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('reorders completed checklist items without row animation for reduced motion', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
    let modelItems = [
      taskChecklistItemFixture({
        id: 'item-a',
        title: 'First open item',
        completed: false,
        order_key: 'a0',
      }),
      taskChecklistItemFixture({
        id: 'item-b',
        title: 'Second open item',
        completed: false,
        order_key: 'a1',
      }),
    ];
    mockUseTaskChecklist.mockImplementation(() => checklistModel(modelItems));
    setCompleted.mockImplementation(async (item, completed) => {
      const completedItem = { ...item, completed, order_key: 'z0' };
      modelItems = [modelItems[1], completedItem];
      return completedItem;
    });
    const { container, root } = renderEditor();

    try {
      const animations: ReturnType<typeof vi.fn>[] = [];
      for (const row of container.querySelectorAll<HTMLElement>('[data-checklist-item-id]')) {
        const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
        animations.push(animate);
        Object.defineProperty(row, 'animate', {
          configurable: true,
          value: animate,
        });
      }
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete First open item"]',
      )!;

      await act(async () => {
        complete.click();
        root.render(<TaskChecklistEditor ownerId="owner-a" taskId="task-a" />);
        await Promise.resolve();
      });

      expect(setCompleted).toHaveBeenCalledTimes(1);
      expect(animations.every((animate) => animate.mock.calls.length === 0)).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
      cleanup(root, container);
    }
  });

  it('owns unmodified Return, inserts one draft input, and ignores composition', async () => {
    const { container, root } = renderEditor();
    const bubbledKeyDown = vi.fn();
    document.addEventListener('keydown', bubbledKeyDown);
    try {
      const existing = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      expect(existing.getAttribute('data-bathos-field-return-owned')).toBe('true');

      await act(async () => {
        existing.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }));
      });
      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeNull();
      bubbledKeyDown.mockClear();

      await act(async () => {
        existing.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(container.querySelectorAll('input[aria-label="New Checklist Item"]')).toHaveLength(1);
      expect(bubbledKeyDown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', bubbledKeyDown);
      cleanup(root, container);
    }
  });

  it('splits a persisted checklist item at the caret and focuses the suffix', async () => {
    const item = taskChecklistItemFixture({
      id: 'item-a',
      title: 'AlphaBeta',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([item]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      input.focus();
      input.setSelectionRange(5, 5);

      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(input.value).toBe('Alpha');
      expect(draft.value).toBe('Beta');
      expect(updateItem).toHaveBeenCalledWith('item-a', { title: 'Alpha' });
      expect(document.activeElement).toBe(draft);
      expect(draft.selectionStart).toBe(0);
    } finally {
      cleanup(root, container);
    }
  });

  it('replaces a selected checklist range with the Return line split', async () => {
    const item = taskChecklistItemFixture({
      id: 'item-a',
      title: 'AlphaBeta',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([item]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      input.focus();
      input.setSelectionRange(5, 7);

      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      expect(input.value).toBe('Alpha');
      expect(container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )?.value).toBe('ta');
    } finally {
      cleanup(root, container);
    }
  });

  it('moves vertically through persisted and draft checklist inputs at value ends', async () => {
    const first = taskChecklistItemFixture({
      id: 'item-a',
      title: 'AlphaBeta',
    });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const persisted = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      persisted[0].focus();
      persisted[0].setSelectionRange(persisted[0].value.length, persisted[0].value.length);
      await act(async () => {
        persisted[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(document.activeElement).toBe(draft);
      expect(draft.selectionStart).toBe(draft.value.length);

      await act(async () => {
        draft.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[1]);
      expect(persisted[1].selectionStart).toBe(persisted[1].value.length);
      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeNull();

      await act(async () => {
        persisted[1].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[0]);
      expect(persisted[0].selectionStart).toBe(persisted[0].value.length);
    } finally {
      cleanup(root, container);
    }
  });

  it('moves horizontally across persisted and draft checklist boundaries', async () => {
    const first = taskChecklistItemFixture({
      id: 'item-a',
      title: 'First',
    });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const persisted = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      persisted[0].focus();
      persisted[0].setSelectionRange(persisted[0].value.length, persisted[0].value.length);
      await act(async () => {
        persisted[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      draft.focus();
      draft.setSelectionRange(0, 0);
      await act(async () => {
        draft.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[0]);
      expect(persisted[0].selectionStart).toBe(persisted[0].value.length);
      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeNull();

      await act(async () => {
        persisted[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[1]);
      expect(persisted[1].selectionStart).toBe(0);

      await act(async () => {
        persisted[1].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[0]);
      expect(persisted[0].selectionStart).toBe(persisted[0].value.length);
    } finally {
      cleanup(root, container);
    }
  });

  it('moves horizontally across checklist boundaries with Option on macOS', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const first = taskChecklistItemFixture({
      id: 'item-a',
      title: 'First',
    });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const persisted = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      persisted[1].focus();
      persisted[1].setSelectionRange(0, 0);
      await act(async () => {
        persisted[1].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[0]);
      expect(persisted[0].selectionStart).toBe(persisted[0].value.length);
      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeNull();

      await act(async () => {
        persisted[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[1]);
      expect(persisted[1].selectionStart).toBe(0);

      persisted[0].focus();
      persisted[0].setSelectionRange(persisted[0].value.length, persisted[0].value.length);
      await act(async () => {
        persisted[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(document.activeElement).toBe(draft);

      await act(async () => {
        draft.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[0]);
      expect(persisted[0].selectionStart).toBe(persisted[0].value.length);

      await act(async () => {
        persisted[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(document.activeElement).toBe(persisted[1]);
      expect(persisted[1].selectionStart).toBe(0);
    } finally {
      cleanup(root, container);
      platform.mockRestore();
    }
  });

  it('leaves horizontal input behavior native outside eligible boundaries', () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      const dispatchArrow = (
        input: HTMLInputElement,
        key: 'ArrowLeft' | 'ArrowRight',
        start: number,
        end = start,
        modifiers: KeyboardEventInit = {},
      ) => {
        input.focus();
        input.setSelectionRange(start, end);
        const event = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
          ...modifiers,
        });
        expect(input.dispatchEvent(event)).toBe(true);
        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input);
      };

      dispatchArrow(inputs[0], 'ArrowLeft', 0);
      dispatchArrow(inputs[1], 'ArrowRight', inputs[1].value.length);
      dispatchArrow(inputs[0], 'ArrowRight', 2);
      dispatchArrow(inputs[0], 'ArrowRight', 1, 3);
      dispatchArrow(
        inputs[0],
        'ArrowRight',
        inputs[0].value.length,
        inputs[0].value.length,
        { shiftKey: true },
      );
      dispatchArrow(inputs[0], 'ArrowRight', 2, 2, { altKey: true });
      dispatchArrow(inputs[0], 'ArrowRight', 1, 3, { altKey: true });
      dispatchArrow(
        inputs[0],
        'ArrowRight',
        inputs[0].value.length,
        inputs[0].value.length,
        { altKey: true, shiftKey: true },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('leaves non-macOS Alt arrow behavior native at checklist boundaries', () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('Win32');
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      const left = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      inputs[1].focus();
      inputs[1].setSelectionRange(0, 0);
      expect(inputs[1].dispatchEvent(left)).toBe(true);
      expect(left.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(inputs[1]);

      const right = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      inputs[0].focus();
      inputs[0].setSelectionRange(inputs[0].value.length, inputs[0].value.length);
      expect(inputs[0].dispatchEvent(right)).toBe(true);
      expect(right.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(inputs[0]);
    } finally {
      cleanup(root, container);
      platform.mockRestore();
    }
  });

  it('leaves vertical arrow behavior native at checklist boundaries', () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      const up = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      const down = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });

      expect(inputs[0].dispatchEvent(up)).toBe(true);
      expect(up.defaultPrevented).toBe(false);
      expect(inputs[1].dispatchEvent(down)).toBe(true);
      expect(down.defaultPrevented).toBe(false);
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
      expect(createItem).toHaveBeenCalledWith('First step', 0);
      expect(createItem).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('flushes the final checklist draft before its task editor closes', async () => {
    mockUseTaskChecklist.mockReturnValue(checklistModel([]));
    let flush: (() => Promise<void>) | null = null;
    const { container, root } = renderEditor(undefined, {
      onRegisterFlush: (nextFlush) => {
        flush = nextFlush;
      },
    });
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Add Checklist"]')?.click();
      });
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      await act(async () => setInput(input, 'Final step'));

      await act(async () => {
        await flush?.();
      });

      expect(createItem).toHaveBeenCalledWith('Final step', 0);
      expect(createItem).toHaveBeenCalledTimes(1);
      expect(container.querySelector('input[aria-label="New Checklist Item"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('splits a new checklist draft at the caret and keeps editing the suffix', async () => {
    const modelItems: ReturnType<typeof taskChecklistItemFixture>[] = [];
    createItem.mockImplementation(async (title: string, destinationIndex: number) => {
      const created = taskChecklistItemFixture({
        id: 'created-item',
        title,
      });
      modelItems.splice(destinationIndex, 0, created);
      return created;
    });
    mockUseTaskChecklist.mockImplementation(() => checklistModel(modelItems));
    const { container, root } = renderEditor();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Add Checklist"]')?.click();
      });
      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      await act(async () => setInput(draft, 'AlphaBeta'));
      draft.setSelectionRange(5, 5);

      await act(async () => {
        draft.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const nextDraft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(createItem).toHaveBeenCalledWith('Alpha', 0);
      expect(container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )?.value).toBe('Alpha');
      expect(nextDraft.value).toBe('Beta');
      expect(document.activeElement).toBe(nextDraft);
      expect(nextDraft.selectionStart).toBe(0);
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

  it('deletes the first empty checklist row when it cannot join backward', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      await act(async () => setInput(input, ''));
      input.setSelectionRange(0, 0);
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(deleteItem).toHaveBeenCalledWith('item-a');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a following empty draft visible when the preceding item is deleted', async () => {
    const modelItems = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First step' }),
    ];
    deleteItem.mockImplementation(async (itemId: string) => {
      const index = modelItems.findIndex(({ id }) => id === itemId);
      if (index >= 0) modelItems.splice(index, 1);
    });
    mockUseTaskChecklist.mockImplementation(() => checklistModel(modelItems));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      input.setSelectionRange(input.value.length, input.value.length);
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      await act(async () => {
        setInput(input, '');
        await Promise.resolve();
      });
      input.setSelectionRange(0, 0);
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });

      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(deleteItem).toHaveBeenCalledWith('item-a');
      expect(draft).not.toBeNull();
      expect(document.activeElement).toBe(draft);
    } finally {
      cleanup(root, container);
    }
  });

  it('joins adjacent checklist rows backward and preserves the caret boundary', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First ' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      inputs[1].setSelectionRange(0, 0);
      await act(async () => {
        inputs[1].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(updateItem).toHaveBeenCalledWith('item-a', { title: 'First second' });
      expect(deleteItem).toHaveBeenCalledWith('item-b');
      expect(document.activeElement).toBe(inputs[0]);
      expect(inputs[0].selectionStart).toBe('First '.length);
    } finally {
      cleanup(root, container);
    }
  });

  it('joins adjacent checklist rows forward and preserves the caret boundary', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First ' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      inputs[0].setSelectionRange(inputs[0].value.length, inputs[0].value.length);
      await act(async () => {
        inputs[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      expect(updateItem).toHaveBeenCalledWith('item-a', { title: 'First second' });
      expect(deleteItem).toHaveBeenCalledWith('item-b');
      expect(document.activeElement).toBe(inputs[0]);
      expect(inputs[0].selectionStart).toBe('First '.length);
    } finally {
      cleanup(root, container);
    }
  });

  it('leaves Select All native to one input', () => {
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      expect(input.dispatchEvent(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      expect(updateItem).not.toHaveBeenCalled();
      expect(deleteItem).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('makes an empty row directly draggable and omits handles and the append button', async () => {
    const { container, root } = renderEditor();
    try {
      const existing = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      await act(async () => {
        existing.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      const draftInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      expect(draftInput.draggable).toBe(true);
      expect(draftInput.closest<HTMLElement>('[data-checklist-item-id="draft"]')?.draggable)
        .toBe(true);
      expect(container.querySelector('[data-checklist-reorder-handle]')).toBeNull();
      expect(container.querySelector('button[aria-label="Add Checklist Item"]')).toBeNull();
      expect(existing.className).toContain('h-8');
      expect(existing.closest('div')?.className).not.toContain('transition-transform');
      expect(draftInput.closest('div')?.className).not.toContain('transition-transform');
    } finally {
      cleanup(root, container);
    }
  });

  it('moves the empty row from its input before it is persisted', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const firstInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      await act(async () => {
        firstInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      const draftInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => draftInput.dispatchEvent(dragStart));

      const secondRow = container.querySelector<HTMLElement>(
        '[data-checklist-item-id="item-b"]',
      )!;
      const sharedBoundaryDragOver = new Event('dragover', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(sharedBoundaryDragOver, 'dataTransfer', { value: dataTransfer });
      await act(async () => secondRow.dispatchEvent(sharedBoundaryDragOver));
      expect(container.querySelectorAll('[data-checklist-drop-indicator]')).toHaveLength(1);

      const firstRow = firstInput.closest('div')!;
      const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(dragOver, 'dataTransfer', { value: dataTransfer });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        firstRow.dispatchEvent(dragOver);
        firstRow.dispatchEvent(drop);
        await waitForAnimationFrames();
      });

      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label$="Checklist Item"]',
      );
      expect(inputs[0].getAttribute('aria-label')).toBe('New Checklist Item');
      expect(createItem).not.toHaveBeenCalled();
      expect(reorderItem).not.toHaveBeenCalled();
      expect(reorderItems).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('reorders directly from the checklist input and accepts the final drop position', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const row = input.closest<HTMLElement>('[data-checklist-item-id]')!;
      expect(input.draggable).toBe(true);
      expect(row.draggable).toBe(true);
      act(() => {
        input.focus();
        input.setSelectionRange(3, 3);
      });
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(3);
      expect(row.dataset.selected).toBeUndefined();

      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => input.dispatchEvent(dragStart));
      expect(document.activeElement).not.toBe(input);
      expect(row.dataset.selected).toBeUndefined();
      expect(
        container.querySelector('[data-task-checklist]')
          ?.getAttribute('data-checklist-selection-active'),
      ).toBeNull();

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
      expect(reorderItems).toHaveBeenCalledWith(['item-a'], 2);
      expect(reorderItems).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps checklist drag start and drag end out of the enclosing task drag scope', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first]));
    const outerDragStart = vi.fn();
    const outerDragEnd = vi.fn();
    document.addEventListener('dragstart', outerDragStart);
    document.addEventListener('dragend', outerDragEnd);
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      const dragEnd = new Event('dragend', { bubbles: true, cancelable: true });
      Object.defineProperty(dragEnd, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        input.dispatchEvent(dragStart);
        input.dispatchEvent(dragEnd);
      });

      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/x-bathos-checklist-item',
        'item-a',
      );
      expect(outerDragStart).not.toHaveBeenCalled();
      expect(outerDragEnd).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('dragstart', outerDragStart);
      document.removeEventListener('dragend', outerDragEnd);
      cleanup(root, container);
    }
  });

  it('commits the last valid checklist position when dropped elsewhere in BathOS', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        dropEffect: 'none',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => input.dispatchEvent(dragStart));

      const end = container.querySelector<HTMLElement>('[data-checklist-drop-end]')!;
      const validDragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(validDragOver, 'dataTransfer', { value: dataTransfer });
      await act(async () => end.dispatchEvent(validDragOver));

      const outsideDragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(outsideDragOver, 'dataTransfer', { value: dataTransfer });
      const outsideDrop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(outsideDrop, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        document.body.dispatchEvent(outsideDragOver);
        document.body.dispatchEvent(outsideDrop);
        await Promise.resolve();
      });

      expect(outsideDragOver.defaultPrevented).toBe(true);
      expect(dataTransfer.dropEffect).toBe('move');
      expect(outsideDrop.defaultPrevented).toBe(true);
      expect(reorderItems).toHaveBeenCalledWith(['item-a'], 2);
      expect(reorderItems).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('moves an empty checklist draft at its last valid position after an outside drop', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const firstInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      await act(async () => {
        firstInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      const draftInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        dropEffect: 'none',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => draftInput.dispatchEvent(dragStart));

      const end = container.querySelector<HTMLElement>('[data-checklist-drop-end]')!;
      const validDragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(validDragOver, 'dataTransfer', { value: dataTransfer });
      await act(async () => end.dispatchEvent(validDragOver));

      const outsideDrop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(outsideDrop, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        document.body.dispatchEvent(outsideDrop);
        await waitForAnimationFrames();
      });

      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label$="Checklist Item"]',
      );
      expect(inputs[inputs.length - 1].getAttribute('aria-label')).toBe(
        'New Checklist Item',
      );
      expect(createItem).not.toHaveBeenCalled();
      expect(reorderItems).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('ignores an outside drop until a valid checklist position has been visited', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        dropEffect: 'none',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => input.dispatchEvent(dragStart));

      const outsideDrop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(outsideDrop, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        document.body.dispatchEvent(outsideDrop);
        await Promise.resolve();
      });

      expect(outsideDrop.defaultPrevented).toBe(false);
      expect(reorderItems).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('cancels a checklist drag that ends without an in-app drop', async () => {
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First step' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second step',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const dataTransfer = {
        effectAllowed: '',
        dropEffect: 'none',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => input.dispatchEvent(dragStart));

      const end = container.querySelector<HTMLElement>('[data-checklist-drop-end]')!;
      const validDragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(validDragOver, 'dataTransfer', { value: dataTransfer });
      await act(async () => end.dispatchEvent(validDragOver));
      expect(end.querySelector('.bg-info')).not.toBeNull();

      const dragEnd = new Event('dragend', { bubbles: true, cancelable: true });
      Object.defineProperty(dragEnd, 'dataTransfer', { value: dataTransfer });
      await act(async () => input.dispatchEvent(dragEnd));

      expect(reorderItems).not.toHaveBeenCalled();
      expect(end.querySelector('.bg-info')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('selects checklist items additively from the focused item and by anchored range', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const items = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
      taskChecklistItemFixture({ id: 'item-b', title: 'Second', order_key: 'a1' }),
      taskChecklistItemFixture({ id: 'item-c', title: 'Third', order_key: 'a2' }),
      taskChecklistItemFixture({ id: 'item-d', title: 'Fourth', order_key: 'a3' }),
    ];
    mockUseTaskChecklist.mockReturnValue(checklistModel(items));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[2].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBeUndefined();
      expect(rows[2].dataset.selected).toBe('true');
      expect(document.activeElement).not.toBe(inputs[0]);
      expect(
        container.querySelector('[data-checklist-selection-active="true"]'),
      ).toBeTruthy();

      const typedKey = new KeyboardEvent('keydown', {
        key: 'x',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => document.dispatchEvent(typedKey));
      expect(typedKey.defaultPrevented).toBe(true);
      expect(inputs[0]).toHaveValue('First');
      expect(inputs[2]).toHaveValue('Third');

      await act(async () => {
        rows[3].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
          button: 0,
        }));
      });
      expect([...rows].map((row) => row.dataset.selected)).toEqual([
        'true',
        'true',
        'true',
        'true',
      ]);
      expect(document.activeElement).not.toBe(inputs[0]);

      await act(async () => {
        rows[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      expect(rows[1].dataset.selected).toBeUndefined();
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[2].dataset.selected).toBe('true');
      expect(rows[3].dataset.selected).toBe('true');
      expect(document.activeElement).not.toBe(inputs[0]);
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('clears additive and range checklist selection with Escape without mutating items', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const items = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
      taskChecklistItemFixture({ id: 'item-b', title: 'Second', order_key: 'a1' }),
      taskChecklistItemFixture({ id: 'item-c', title: 'Third', order_key: 'a2' }),
    ];
    mockUseTaskChecklist.mockReturnValue(checklistModel(items));
    const outerKeyDown = vi.fn();
    window.addEventListener('keydown', outerKeyDown);
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');

      act(() => inputs[0].focus());
      await act(async () => {
        rows[2].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[2].dataset.selected).toBe('true');

      const additiveEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => document.dispatchEvent(additiveEscape));
      expect(additiveEscape.defaultPrevented).toBe(true);
      expect([...rows].every((row) => row.dataset.selected === undefined)).toBe(true);
      expect(container.querySelector('[data-checklist-selection-active="true"]')).toBeNull();
      expect(document.activeElement).not.toBe(inputs[0]);
      expect(outerKeyDown).not.toHaveBeenCalled();

      act(() => inputs[0].focus());
      await act(async () => {
        rows[2].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
          button: 0,
        }));
      });
      expect([...rows].map((row) => row.dataset.selected)).toEqual([
        'true',
        'true',
        'true',
      ]);

      const rangeEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => document.dispatchEvent(rangeEscape));
      expect(rangeEscape.defaultPrevented).toBe(true);
      expect([...rows].every((row) => row.dataset.selected === undefined)).toBe(true);
      expect(container.querySelectorAll('input[aria-label="Checklist Item"]')).toHaveLength(3);
      expect(document.activeElement).not.toBe(inputs[0]);
      expect(deleteItems).not.toHaveBeenCalled();
      expect(deleteItem).not.toHaveBeenCalled();
      expect(reorderItems).not.toHaveBeenCalled();
      expect(setCompleted).not.toHaveBeenCalled();
      expect(outerKeyDown).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', outerKeyDown);
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('clears checklist selection on an ordinary click while preserving the clicked control', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBe('true');

      const secondInput = rows[1].querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      secondInput.setSelectionRange(3, 3);
      await act(async () => {
        secondInput.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }));
        secondInput.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }));
      });
      expect(rows[0].dataset.selected).toBeUndefined();
      expect(rows[1].dataset.selected).toBeUndefined();
      expect(secondInput).not.toBeDisabled();
      expect(document.activeElement).toBe(secondInput);
      expect(secondInput.selectionStart).toBe(3);
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('replaces completion controls with selection circles and preserves completion styling', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
      completed: true,
    });
    const third = taskChecklistItemFixture({
      id: 'item-c',
      title: 'Third',
      order_key: 'a2',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second, third]));
    const { container, root } = renderEditor();
    try {
      const firstInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      act(() => firstInput.focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });

      expect(rows[0].querySelector('svg.lucide-circle-check')).toBeTruthy();
      expect(rows[1].querySelector('svg.lucide-circle-check')).toBeTruthy();
      expect(rows[2].querySelector('svg.lucide-circle')).toBeTruthy();
      expect(rows[1].querySelector('input[aria-label="Checklist Item"]'))
        .toHaveClass('line-through');

      const secondSelectionControl = rows[1].querySelector<HTMLButtonElement>(
        'button[aria-label="Deselect Second"]',
      )!;
      await act(async () => {
        secondSelectionControl.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }));
        secondSelectionControl.click();
        await Promise.resolve();
      });

      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBeUndefined();
      expect(rows[0].querySelector('svg.lucide-circle-check')).toBeTruthy();
      expect(rows[1].querySelector('svg.lucide-circle')).toBeTruthy();
      expect(rows[1].querySelector('input[aria-label="Checklist Item"]'))
        .toHaveClass('line-through');
      expect(setCompleted).not.toHaveBeenCalled();

      const firstSelectionControl = rows[0].querySelector<HTMLButtonElement>(
        'button[aria-label="Deselect First"]',
      )!;
      await act(async () => {
        firstSelectionControl.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }));
        firstSelectionControl.click();
        await Promise.resolve();
      });

      expect(container.querySelector('[data-checklist-selection-active="true"]')).toBeNull();
      expect(rows[0].querySelector('button[aria-label="Complete First"]')).toBeTruthy();
      expect(rows[1].querySelector('button[aria-label="Reopen Second"]')).toBeTruthy();
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('drags selected checklist items as one visual-order group and keeps them selected', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const items = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
      taskChecklistItemFixture({ id: 'item-b', title: 'Second', order_key: 'a1' }),
      taskChecklistItemFixture({ id: 'item-c', title: 'Third', order_key: 'a2' }),
    ];
    mockUseTaskChecklist.mockReturnValue(checklistModel(items));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[2].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });

      expect(rows[0].draggable).toBe(true);
      expect(rows[1].draggable).toBe(true);
      expect(rows[2].draggable).toBe(true);
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => rows[0].dispatchEvent(dragStart));

      expect(dataTransfer.effectAllowed).toBe('move');
      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/x-bathos-checklist-item',
        'item-a',
      );
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[2].dataset.selected).toBe('true');

      const end = container.querySelector<HTMLElement>('[data-checklist-drop-end]')!;
      const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(dragOver, 'dataTransfer', { value: dataTransfer });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        end.dispatchEvent(dragOver);
        document.body.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(drop.defaultPrevented).toBe(true);
      expect(reorderItems).toHaveBeenCalledWith(['item-a', 'item-c'], 3);
      expect(reorderItems).toHaveBeenCalledTimes(1);
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[2].dataset.selected).toBe('true');
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('removes input focus when a selected-row drag begins from that input', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const first = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    const second = taskChecklistItemFixture({
      id: 'item-b',
      title: 'Second',
      order_key: 'a1',
    });
    mockUseTaskChecklist.mockReturnValue(checklistModel([first, second]));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBe('true');
      expect(inputs[0].draggable).toBe(true);
      expect(inputs[1].draggable).toBe(true);

      act(() => {
        inputs[1].focus();
        inputs[1].setSelectionRange(2, 2);
      });
      expect(document.activeElement).toBe(inputs[1]);

      await act(async () => {
        inputs[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 20,
          clientY: 20,
        }));
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientX: 28,
          clientY: 20,
        }));
      });
      expect(document.activeElement).not.toBe(inputs[1]);

      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => inputs[1].dispatchEvent(dragStart));

      expect(document.activeElement).not.toBe(inputs[1]);
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBe('true');

      const dragEnd = new Event('dragend', { bubbles: true, cancelable: true });
      await act(async () => {
        inputs[1].dispatchEvent(dragEnd);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        inputs[1].click();
      });
      expect(document.activeElement).not.toBe(inputs[1]);
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBe('true');

      await act(async () => {
        inputs[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }));
        inputs[1].click();
      });
      expect(document.activeElement).toBe(inputs[1]);
      expect(rows[0].dataset.selected).toBeUndefined();
      expect(rows[1].dataset.selected).toBeUndefined();
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('copies selected checklist items in visual order with completion state', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const items = [
      taskChecklistItemFixture({
        id: 'item-a',
        title: 'First',
        order_key: 'a0',
        completed: 0 as unknown as boolean,
      }),
      taskChecklistItemFixture({
        id: 'item-b',
        title: 'Second',
        order_key: 'a1',
        completed: 1 as unknown as boolean,
      }),
      taskChecklistItemFixture({ id: 'item-c', title: 'Third', order_key: 'a2' }),
    ];
    mockUseTaskChecklist.mockReturnValue(checklistModel(items));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[1].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      const { event, setData } = clipboardWriteEvent('copy');
      await act(async () => {
        window.dispatchEvent(event);
        await Promise.resolve();
      });
      await waitFor(() => expect(setData).toHaveBeenCalled());

      expect(JSON.parse(setData.mock.calls[0][1] as string)).toEqual({
        kind: TASK_CHECKLIST_CLIPBOARD_KIND,
        version: 1,
        operation: 'copy',
        items: [
          { title: 'First', completed: false },
          { title: 'Second', completed: true },
        ],
      });
      expect(event.defaultPrevented).toBe(true);
      expect(deleteItems).not.toHaveBeenCalled();
      expect(rows[0].dataset.selected).toBe('true');
      expect(rows[1].dataset.selected).toBe('true');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Checklist Items Copied',
        description: '2 checklist items copied.',
      });
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('cuts selected checklist items only after the clipboard write succeeds', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const items = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
      taskChecklistItemFixture({ id: 'item-b', title: 'Second', order_key: 'a1' }),
      taskChecklistItemFixture({ id: 'item-c', title: 'Third', order_key: 'a2' }),
    ];
    mockUseTaskChecklist.mockReturnValue(checklistModel(items));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[2].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      const { event, setData } = clipboardWriteEvent('cut');
      await act(async () => {
        window.dispatchEvent(event);
        await Promise.resolve();
      });
      await waitFor(() => expect(deleteItems).toHaveBeenCalled());

      expect(JSON.parse(setData.mock.calls[0][1] as string)).toMatchObject({
        operation: 'cut',
        items: [
          { title: 'First', completed: false },
          { title: 'Third', completed: false },
        ],
      });
      expect(deleteItems).toHaveBeenCalledWith(['item-a', 'item-c']);
      expect(rows[0].dataset.selected).toBeUndefined();
      expect(rows[2].dataset.selected).toBeUndefined();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Checklist Items Cut',
        description: '2 checklist items cut.',
      });
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('keeps selected checklist items when a cut cannot write to the clipboard', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const item = taskChecklistItemFixture({ id: 'item-a', title: 'First' });
    mockUseTaskChecklist.mockReturnValue(checklistModel([item]));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      act(() => input.focus());
      const row = container.querySelector<HTMLElement>('[data-checklist-item-id]')!;
      await act(async () => {
        row.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });
      const event = new Event('cut', {
        bubbles: true,
        cancelable: true,
      }) as ClipboardEvent;
      await act(async () => {
        window.dispatchEvent(event);
        await Promise.resolve();
      });
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Checklist Items Could Not Be Cut',
        variant: 'destructive',
      })));

      expect(deleteItems).not.toHaveBeenCalled();
      expect(row.dataset.selected).toBe('true');
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });

  it('pastes copied checklist items after the focused saved item', async () => {
    const modelItems = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
      taskChecklistItemFixture({ id: 'item-b', title: 'Second', order_key: 'a1' }),
    ];
    const created = [
      taskChecklistItemFixture({ id: 'item-copy-a', title: 'Copied Open', order_key: 'a2' }),
      taskChecklistItemFixture({
        id: 'item-copy-b',
        title: 'Copied Done',
        completed: true,
        order_key: 'a3',
      }),
    ];
    createItemCopies.mockImplementation(async (
      _items: unknown,
      destinationIndex: number,
    ) => {
      modelItems.splice(destinationIndex, 0, ...created);
      return created;
    });
    mockUseTaskChecklist.mockImplementation(() => checklistModel(modelItems));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      const paste = pasteEvent(serializeTaskChecklistClipboard('copy', [
        { title: 'Copied Open', completed: false },
        { title: 'Copied Done', completed: true },
      ]));
      await act(async () => {
        inputs[0].dispatchEvent(paste);
        await Promise.resolve();
      });
      await waitFor(() => expect(createItemCopies).toHaveBeenCalled());
      await act(async () => {
        root.render(<TaskChecklistEditor ownerId="owner-a" taskId="task-a" />);
        await waitForAnimationFrames();
      });

      expect(paste.defaultPrevented).toBe(true);
      expect(createItemCopies).toHaveBeenCalledWith([
        { title: 'Copied Open', completed: false },
        { title: 'Copied Done', completed: true },
      ], 1, { occurredAt: expect.any(String) });
      expect(document.activeElement).toBe(
        container.querySelector<HTMLInputElement>(
          '[data-checklist-item-id="item-copy-b"] input',
        ),
      );
      expect(mockToast).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('pastes copied checklist items at a focused draft and shifts the draft down', async () => {
    const modelItems = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
    ];
    const created = [
      taskChecklistItemFixture({ id: 'item-copy-a', title: 'Copied Open', order_key: 'a1' }),
      taskChecklistItemFixture({ id: 'item-copy-b', title: 'Copied Done', order_key: 'a2' }),
    ];
    createItemCopies.mockImplementation(async (
      _items: unknown,
      destinationIndex: number,
    ) => {
      modelItems.splice(destinationIndex, 0, ...created);
      return created;
    });
    createItem.mockImplementation(async (title: string, destinationIndex: number) => {
      const committedDraft = taskChecklistItemFixture({
        id: 'item-draft',
        title,
        order_key: 'a3',
      });
      modelItems.splice(destinationIndex, 0, committedDraft);
      return committedDraft;
    });
    mockUseTaskChecklist.mockImplementation(() => checklistModel(modelItems));
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await waitForAnimationFrames();
      });
      const draft = container.querySelector<HTMLInputElement>(
        'input[aria-label="New Checklist Item"]',
      )!;
      setInput(draft, 'Keep Draft');
      const paste = pasteEvent(serializeTaskChecklistClipboard('cut', [
        { title: 'Copied Open', completed: false },
        { title: 'Copied Done', completed: true },
      ]));
      await act(async () => {
        draft.dispatchEvent(paste);
        await Promise.resolve();
      });
      await waitFor(() => expect(createItemCopies).toHaveBeenCalled());
      await act(async () => {
        root.render(<TaskChecklistEditor ownerId="owner-a" taskId="task-a" />);
        await waitForAnimationFrames();
      });

      expect(createItemCopies).toHaveBeenCalledWith([
        { title: 'Copied Open', completed: false },
        { title: 'Copied Done', completed: true },
      ], 1, { occurredAt: expect.any(String) });
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      expect([...rows].map(({ dataset }) => dataset.checklistItemId)).toEqual([
        'item-a',
        'item-copy-a',
        'item-copy-b',
        'item-draft',
      ]);
      expect(container.querySelector<HTMLInputElement>(
        '[data-checklist-item-id="item-draft"] input',
      )).toHaveValue('Keep Draft');
      expect(document.activeElement).toBe(
        container.querySelector<HTMLInputElement>(
          '[data-checklist-item-id="item-copy-b"] input',
        ),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('rejects a malformed internal checklist payload without changing the checklist', () => {
    const { container, root } = renderEditor();
    try {
      const input = container.querySelector<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      )!;
      const paste = pasteEvent(JSON.stringify({
        kind: TASK_CHECKLIST_CLIPBOARD_KIND,
        version: 1,
        operation: 'copy',
        items: [{ title: '', completed: false }],
      }));
      input.dispatchEvent(paste);

      expect(paste.defaultPrevented).toBe(true);
      expect(createItemCopies).not.toHaveBeenCalled();
      expect(createItems).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Checklist Items Could Not Be Pasted',
        variant: 'destructive',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('deletes every selected checklist item with Backspace and clears the selection', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get')
      .mockReturnValue('MacIntel');
    const items = [
      taskChecklistItemFixture({ id: 'item-a', title: 'First', order_key: 'a0' }),
      taskChecklistItemFixture({ id: 'item-b', title: 'Second', order_key: 'a1' }),
      taskChecklistItemFixture({ id: 'item-c', title: 'Third', order_key: 'a2' }),
    ];
    mockUseTaskChecklist.mockReturnValue(checklistModel(items));
    const { container, root } = renderEditor();
    try {
      const inputs = container.querySelectorAll<HTMLInputElement>(
        'input[aria-label="Checklist Item"]',
      );
      act(() => inputs[0].focus());
      const rows = container.querySelectorAll<HTMLElement>('[data-checklist-item-id]');
      await act(async () => {
        rows[2].dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        }));
      });

      const deletion = new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        document.dispatchEvent(deletion);
        await Promise.resolve();
      });
      expect(deletion.defaultPrevented).toBe(true);
      expect(deleteItems).toHaveBeenCalledWith(['item-a', 'item-c']);
      expect(rows[0].dataset.selected).toBeUndefined();
      expect(rows[2].dataset.selected).toBeUndefined();
      expect(deleteItem).not.toHaveBeenCalled();
    } finally {
      platform.mockRestore();
      cleanup(root, container);
    }
  });
});
