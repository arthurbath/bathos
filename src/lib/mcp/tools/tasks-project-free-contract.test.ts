import { describe, expect, it } from 'vitest';

import { createTaskArea, createTaskChecklistItem } from './tasks-hierarchy-create';
import { transitionTaskHierarchy } from './tasks-hierarchy-transition';
import { updateTaskArea, updateTaskChecklistItem } from './tasks-hierarchy-update';
import { getTaskHierarchy, getTaskRecord } from './tasks-read';

describe('project-free Tasks MCP contract', () => {
  it('exposes only Area and checklist hierarchy mutations', () => {
    expect([
      createTaskArea.name,
      createTaskChecklistItem.name,
      updateTaskArea.name,
      updateTaskChecklistItem.name,
      transitionTaskHierarchy.name,
    ]).toEqual([
      'create_task_area',
      'create_task_checklist_item',
      'update_task_area',
      'update_task_checklist_item',
      'transition_task_hierarchy',
    ]);
  });

  it('keeps hierarchy reads without a Project tool', () => {
    expect([getTaskHierarchy.name, getTaskRecord.name]).toEqual([
      'get_task_hierarchy',
      'get_task_record',
    ]);
  });
});
