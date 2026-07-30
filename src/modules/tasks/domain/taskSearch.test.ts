import { describe, expect, it } from 'vitest';

import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
  rankTaskSearchDocuments,
} from './taskSearch';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

describe('task search indexing', () => {
  it('indexes the direct Area label', () => {
    const documents = createTaskSearchDocuments([
      taskTodoFixture({ area_id: 'area-a', title: 'Prepare agenda' }),
    ], { areas: [{ id: 'area-a', title: 'Work' }] });

    expect(documents[0].hierarchyLabel).toBe('Work');
    expect(filterTaskSearchDocuments(documents, 'work')).toHaveLength(1);
  });

  it('ranks summary matches above matches in ancillary metadata', () => {
    const documents = createTaskSearchDocuments([
      taskTodoFixture({
        id: 'notes-match',
        title: 'Save Filters',
        notes: 'Review the Figma prototype',
      }),
      taskTodoFixture({
        id: 'url-match',
        title: 'Meter Source Cert Relevance',
        source_url: 'https://figma.com/design/example',
      }),
      taskTodoFixture({
        id: 'summary-match',
        title: 'Review Figma Comment on General Experience',
      }),
    ], { areas: [] });

    const ranked = rankTaskSearchDocuments(
      filterTaskSearchDocuments(documents, 'figma'),
      'figma',
    );

    expect(ranked.map(({ task }) => task.id)).toEqual([
      'summary-match',
      'notes-match',
      'url-match',
    ]);
  });

  it('orders exact and prefix summary matches before other summary matches', () => {
    const documents = createTaskSearchDocuments([
      taskTodoFixture({ id: 'contains', title: 'Review Figma Comment' }),
      taskTodoFixture({ id: 'prefix', title: 'Figma Review' }),
      taskTodoFixture({ id: 'exact', title: 'Figma' }),
    ], { areas: [] });

    expect(rankTaskSearchDocuments(documents, 'figma').map(({ task }) => task.id)).toEqual([
      'exact',
      'prefix',
      'contains',
    ]);
  });
});
