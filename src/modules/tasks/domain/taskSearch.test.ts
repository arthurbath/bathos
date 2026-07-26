import { describe, expect, it } from 'vitest';

import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
} from './taskSearch';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

describe('task search documents', () => {
  it('indexes structured hierarchy once and searches normalized task context', () => {
    const documents = createTaskSearchDocuments([
      task({
        title: 'Replace sink valve',
        project_id: 'project-a',
      }),
    ], {
      areas: [],
      projects: [{ id: 'project-a', title: 'House' }],
    });

    expect(documents[0].hierarchyLabel).toBe('House');
    expect(filterTaskSearchDocuments(documents, 'house'))
      .toHaveLength(1);
    expect(filterTaskSearchDocuments(documents, 'SINK VALVE'.toLocaleLowerCase()))
      .toHaveLength(1);
  });

  it('matches structured source context without exposing advanced filters', () => {
    const documents = createTaskSearchDocuments([
      task({
        id: 'mail',
        source_kind: 'mail_message',
        source_title: 'Architect response',
        source_url: 'message://architect-response',
      }),
      task({ id: 'plain', source_kind: null }),
    ], { areas: [], projects: [] });

    expect(filterTaskSearchDocuments(documents, 'architect response')
      .map(({ task: value }) => value.id)).toEqual(['mail']);
    expect(filterTaskSearchDocuments(documents, 'message://architect')
      .map(({ task: value }) => value.id)).toEqual(['mail']);
  });
});

function task(overrides: Partial<TaskTodo> = {}): TaskTodo {
  return taskTodoFixture({
    title: 'Synthetic task',
    notes: 'Synthetic notes',
    destination: 'anytime',
    today_section: 'next',
    start_date: '2026-07-20',
    ...overrides,
  });
}
