import { describe, expect, it } from 'vitest';

import { deriveTaskAreaSections, getTaskEffectiveAreaId } from './taskAreaViews';
import { taskAreaFixture, taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

describe('task Area views', () => {
  it('uses the task direct Area as its effective organization', () => {
    expect(getTaskEffectiveAreaId(taskTodoFixture({ area_id: 'area-a' }))).toBe('area-a');
    expect(getTaskEffectiveAreaId(taskTodoFixture({ area_id: null }))).toBeNull();
  });

  it('places unassigned tasks first and follows manual Area order', () => {
    const areas = [
      taskAreaFixture({ id: 'area-b', title: 'B', order_key: 'b0' }),
      taskAreaFixture({ id: 'area-a', title: 'A', order_key: 'a0' }),
    ];
    const sections = deriveTaskAreaSections([
      taskTodoFixture({ id: 'unassigned', area_id: null, order_key: 'a0' }),
      taskTodoFixture({ id: 'in-b', area_id: 'area-b', order_key: 'a0' }),
      taskTodoFixture({ id: 'in-a', area_id: 'area-a', order_key: 'a0' }),
      taskTodoFixture({ id: 'orphan', area_id: 'missing', order_key: 'b0' }),
    ], areas);

    expect(sections.map(({ areaId }) => areaId)).toEqual([null, 'area-a', 'area-b']);
    expect(sections[0].tasks.map(({ id }) => id)).toEqual(['unassigned', 'orphan']);
  });
});
