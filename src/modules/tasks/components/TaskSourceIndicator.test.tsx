import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { TaskSourceIndicator } from './TaskSourceIndicator';

function renderIndicator(task: TaskTodo) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<TaskSourceIndicator task={task} />));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('TaskSourceIndicator', () => {
  it('opens web sources in a separate browser tab with a named real link', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Read the brief',
      source_kind: 'reading_item',
      source_url: 'https://example.test/brief',
      source_title: 'The brief',
    }));

    try {
      const link = container.querySelector<HTMLAnchorElement>('a');
      expect(link?.href).toBe('https://example.test/brief');
      expect(link?.target).toBe('_blank');
      expect(link?.rel).toBe('noreferrer');
      expect(link?.getAttribute('aria-label')).toBe('Open Reading Item for Read the brief');
      expect(link?.title).toBe('Reading Item: The brief');
    } finally {
      cleanup(root, container);
    }
  });

  it.each([
    ['mail_message', 'message://synthetic-message', 'Open Mail Message for Follow up'],
    ['file', 'file:///Users/Shared/Synthetic.txt', 'Open File for Follow up'],
  ] as const)('hands %s deep links to the originating platform', (sourceKind, sourceUrl, label) => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Follow up',
      source_kind: sourceKind,
      source_url: sourceUrl,
    }));

    try {
      const link = container.querySelector<HTMLAnchorElement>('a');
      expect(link?.getAttribute('href')).toBe(sourceUrl);
      expect(link?.hasAttribute('target')).toBe(false);
      expect(link?.getAttribute('aria-label')).toBe(label);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps typed provenance visible without linking missing or unsafe source URLs', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Review selection',
      source_kind: 'selected_text',
      source_url: 'javascript:alert(1)',
    }));

    try {
      expect(container.querySelector('a')).toBeNull();
      expect(container.querySelector('[aria-label="Selected Text Source for Review selection"]'))
        .toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('renders nothing for a task without structured source provenance', () => {
    const { container, root } = renderIndicator(taskTodoFixture());

    try {
      expect(container.childElementCount).toBe(0);
    } finally {
      cleanup(root, container);
    }
  });
});
