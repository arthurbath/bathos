import { describe, expect, it } from 'vitest';

import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
  getTaskSearchSourceKinds,
  type TaskSearchFilters,
} from './taskSearch';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

const allFilters: TaskSearchFilters = {
  destination: 'all',
  lifecycle: 'all',
  actionability: 'all',
  sourceKind: 'all',
};

describe('task search documents', () => {
  it('indexes structured hierarchy once and searches normalized task context', () => {
    const documents = createTaskSearchDocuments([
      task({
        title: 'Replace sink valve',
        project_id: 'project-a',
        heading_id: 'heading-a',
      }),
    ], {
      areas: [],
      projects: [{ id: 'project-a', title: 'House' }],
      headings: [{ id: 'heading-a', title: 'Repairs' }],
    });

    expect(documents[0].hierarchyLabel).toBe('House / Repairs');
    expect(filterTaskSearchDocuments(documents, 'house / repairs', allFilters))
      .toHaveLength(1);
    expect(filterTaskSearchDocuments(documents, 'SINK VALVE'.toLocaleLowerCase(), allFilters))
      .toHaveLength(1);
  });

  it('combines typed filters and reports only available structured source kinds', () => {
    const documents = createTaskSearchDocuments([
      task({ id: 'mail', actionability: 'waiting', source_kind: 'mail_message' }),
      task({ id: 'web', destination: 'anytime', source_kind: 'webpage' }),
      task({ id: 'plain', source_kind: null }),
    ], { areas: [], projects: [], headings: [] });

    expect(filterTaskSearchDocuments(documents, '', {
      ...allFilters,
      actionability: 'waiting',
      sourceKind: 'mail_message',
    }).map(({ task: value }) => value.id)).toEqual(['mail']);
    expect(filterTaskSearchDocuments(documents, '', {
      ...allFilters,
      sourceKind: 'none',
    }).map(({ task: value }) => value.id)).toEqual(['plain']);
    expect(getTaskSearchSourceKinds(documents)).toEqual(['mail_message', 'webpage']);
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
