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
  it('opens an explicit web Primary Link in a separate browser context', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Read the brief',
      source_kind: 'reading_item',
      source_url: 'https://example.test/brief',
      source_title: 'The brief',
      primary_link: 'https://example.test/brief',
    }));

    try {
      const link = container.querySelector<HTMLAnchorElement>('a');
      expect(link?.href).toBe('https://example.test/brief');
      expect(link?.target).toBe('_blank');
      expect(link?.rel).toBe('noopener noreferrer');
      expect(link?.getAttribute('aria-label')).toBe('Open Primary Link for Read the brief');
      expect(link?.title).toBe('https://example.test/brief');
    } finally {
      cleanup(root, container);
    }
  });

  it('hands a message Primary Link to Mail', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Follow up',
      source_kind: 'mail_message',
      source_url: 'message://synthetic-message',
      primary_link: 'message://synthetic-message',
    }));

    try {
      const link = container.querySelector<HTMLAnchorElement>('a');
      expect(link?.getAttribute('href')).toBe('message://synthetic-message');
      expect(link?.hasAttribute('target')).toBe(false);
      expect(link?.getAttribute('aria-label')).toBe('Open Mail Link for Follow up');
    } finally {
      cleanup(root, container);
    }
  });

  it('prepends HTTPS when the editable Primary Link has no web protocol', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Read the brief',
      primary_link: 'example.test/brief',
    }));

    try {
      expect(container.querySelector<HTMLAnchorElement>('a')?.getAttribute('href'))
        .toBe('https://example.test/brief');
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
