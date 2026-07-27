import { describe, expect, it } from 'vitest';

import { createTaskSearchDocuments, filterTaskSearchDocuments } from './taskSearch';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

describe('task search indexing', () => {
  it('indexes the direct Area label', () => {
    const documents = createTaskSearchDocuments([
      taskTodoFixture({ area_id: 'area-a', title: 'Prepare agenda' }),
    ], { areas: [{ id: 'area-a', title: 'Work' }] });

    expect(documents[0].hierarchyLabel).toBe('Work');
    expect(filterTaskSearchDocuments(documents, 'work')).toHaveLength(1);
  });
});
