import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { TaskSourceIndicator } from './TaskSourceIndicator';

function renderIndicator(task: TaskTodo, compact = false) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<TaskSourceIndicator task={task} compact={compact} />));
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
      expect(link?.querySelector('svg')).toHaveClass('lucide-link-2');
    } finally {
      cleanup(root, container);
    }
  });

  it('offers a compact task-row footprint without changing the default presentation', () => {
    const taskWithLink = taskTodoFixture({
      title: 'Read the brief',
      primary_link: 'https://example.test/brief',
    });
    const regular = renderIndicator(taskWithLink);
    const compact = renderIndicator(taskWithLink, true);

    try {
      expect(regular.container.querySelector('a')).toHaveClass('h-10', 'w-10');
      expect(compact.container.querySelector('a')).toHaveClass('h-8', 'w-8');
      expect(compact.container.querySelector('a')).not.toHaveClass('h-10', 'w-10');
    } finally {
      cleanup(regular.root, regular.container);
      cleanup(compact.root, compact.container);
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
      expect(link?.querySelector('svg')).toHaveClass('lucide-mail');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses Jira iconography for Jira protocols and recognized Jira URLs', () => {
    const jiraProtocol = renderIndicator(taskTodoFixture({
      title: 'Open PF-766',
      primary_link: 'jira://issue/PF-766',
    }));
    const jiraUrl = renderIndicator(taskTodoFixture({
      title: 'Open PF-767',
      primary_link: 'https://usgbc.atlassian.net/browse/PF-767',
    }));

    try {
      const protocolLink = jiraProtocol.container.querySelector<HTMLAnchorElement>('a');
      const webLink = jiraUrl.container.querySelector<HTMLAnchorElement>('a');
      expect(protocolLink?.getAttribute('href')).toBe('jira://issue/PF-766');
      expect(protocolLink?.hasAttribute('target')).toBe(false);
      expect(protocolLink?.getAttribute('aria-label')).toBe('Open Jira Link for Open PF-766');
      expect(protocolLink?.querySelector('svg')).toHaveClass('lucide-zap');
      expect(webLink?.target).toBe('_blank');
      expect(webLink?.querySelector('svg')).toHaveClass('lucide-zap');
    } finally {
      cleanup(jiraProtocol.root, jiraProtocol.container);
      cleanup(jiraUrl.root, jiraUrl.container);
    }
  });

  it('uses file-text iconography for Obsidian protocols', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Open the note',
      primary_link: 'obsidian://open?vault=Personal&file=Tasks',
    }));

    try {
      const link = container.querySelector<HTMLAnchorElement>('a');
      expect(link?.getAttribute('href')).toBe('obsidian://open?vault=Personal&file=Tasks');
      expect(link?.hasAttribute('target')).toBe(false);
      expect(link?.getAttribute('aria-label')).toBe('Open Obsidian Link for Open the note');
      expect(link?.querySelector('svg')).toHaveClass('lucide-file-text');
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

  it('falls back safely when persisted provenance predates the current source vocabulary', () => {
    const { container, root } = renderIndicator(taskTodoFixture({
      title: 'Imported task',
      source_kind: 'legacy_import' as TaskTodo['source_kind'],
      source_title: 'Earlier source',
    }));

    try {
      expect(container.querySelector('[aria-label="Source Source for Imported task"]'))
        .toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });
});
