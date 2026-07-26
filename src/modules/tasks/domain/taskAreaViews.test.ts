import { describe, expect, it } from 'vitest';

import {
  deriveTaskAnytimeAreaSections,
  getTaskEffectiveAreaId,
} from '@/modules/tasks/domain/taskAreaViews';
import {
  taskAreaFixture,
  taskProjectFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';

describe('task Area planning views', () => {
  it('derives direct and Project-owned Areas without competing membership', () => {
    const projects = [
      taskProjectFixture({ id: 'project-work', area_id: 'area-work' }),
      taskProjectFixture({ id: 'project-loose', area_id: null }),
    ];

    expect(getTaskEffectiveAreaId(
      taskTodoFixture({ area_id: 'area-home', project_id: null }),
      projects,
    )).toBe('area-home');
    expect(getTaskEffectiveAreaId(
      taskTodoFixture({ area_id: null, project_id: 'project-work' }),
      projects,
    )).toBe('area-work');
    expect(getTaskEffectiveAreaId(
      taskTodoFixture({ area_id: null, project_id: 'project-loose' }),
      projects,
    )).toBeNull();
  });

  it('puts unassigned work first and follows manual Area order', () => {
    const areas = [
      taskAreaFixture({ id: 'area-home', title: 'Home', order_key: 'a1' }),
      taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' }),
      taskAreaFixture({ id: 'area-empty', title: 'Empty', order_key: 'a2' }),
    ];
    const projects = [
      taskProjectFixture({ id: 'project-work', area_id: 'area-work' }),
      taskProjectFixture({ id: 'project-loose', area_id: null }),
    ];
    const tasks = [
      taskTodoFixture({
        id: 'home-later',
        area_id: 'area-home',
        project_id: null,
        order_key: 'a4',
      }),
      taskTodoFixture({
        id: 'unassigned',
        area_id: null,
        project_id: null,
        order_key: 'a2',
      }),
      taskTodoFixture({
        id: 'work-project',
        area_id: null,
        project_id: 'project-work',
        order_key: 'a3',
      }),
      taskTodoFixture({
        id: 'work-direct',
        area_id: 'area-work',
        project_id: null,
        order_key: 'a1',
      }),
      taskTodoFixture({
        id: 'project-without-area',
        area_id: null,
        project_id: 'project-loose',
        order_key: 'a0',
      }),
    ];

    const sections = deriveTaskAnytimeAreaSections(tasks, areas, projects);

    expect(sections.map(({ areaId }) => areaId)).toEqual([
      null,
      'area-work',
      'area-home',
    ]);
    expect(sections[0].tasks.map(({ id }) => id)).toEqual([
      'project-without-area',
      'unassigned',
    ]);
    expect(sections[1].tasks.map(({ id }) => id)).toEqual([
      'work-direct',
      'work-project',
    ]);
  });

  it('treats tasks whose effective Area is unavailable as unassigned', () => {
    const task = taskTodoFixture({
      id: 'orphaned-area',
      area_id: 'area-unavailable',
      project_id: null,
    });

    expect(deriveTaskAnytimeAreaSections([task], [], [])[0].tasks).toEqual([task]);
  });
});
