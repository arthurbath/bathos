import { describe, expect, it } from 'vitest';

import {
  sanitizeTaskQuickFilter,
  taskMatchesQuickFilter,
  taskQuickFilterLabels,
} from '@/modules/tasks/domain/taskQuickFilters';

describe('task quick filters', () => {
  it('keeps all supported values and rejects unknown persisted values', () => {
    expect(sanitizeTaskQuickFilter('all')).toBe('all');
    expect(sanitizeTaskQuickFilter('actionable')).toBe('actionable');
    expect(sanitizeTaskQuickFilter('non_actionable')).toBe('non_actionable');
    expect(sanitizeTaskQuickFilter('rechecking')).toBe('rechecking');
    expect(sanitizeTaskQuickFilter('waiting')).toBe('waiting');
    expect(sanitizeTaskQuickFilter('blocked')).toBe('all');
    expect(sanitizeTaskQuickFilter(null)).toBe('all');
  });

  it('matches each fixed actionability filter', () => {
    expect(taskMatchesQuickFilter('actionable', 'all')).toBe(true);
    expect(taskMatchesQuickFilter('waiting', 'all')).toBe(true);
    expect(taskMatchesQuickFilter('rechecking', 'all')).toBe(true);

    expect(taskMatchesQuickFilter('actionable', 'actionable')).toBe(true);
    expect(taskMatchesQuickFilter('waiting', 'actionable')).toBe(false);
    expect(taskMatchesQuickFilter('rechecking', 'actionable')).toBe(false);

    expect(taskMatchesQuickFilter('actionable', 'non_actionable')).toBe(false);
    expect(taskMatchesQuickFilter('waiting', 'non_actionable')).toBe(true);
    expect(taskMatchesQuickFilter('rechecking', 'non_actionable')).toBe(true);

    expect(taskMatchesQuickFilter('waiting', 'waiting')).toBe(true);
    expect(taskMatchesQuickFilter('rechecking', 'waiting')).toBe(false);
    expect(taskMatchesQuickFilter('rechecking', 'rechecking')).toBe(true);
    expect(taskMatchesQuickFilter('waiting', 'rechecking')).toBe(false);
  });

  it('exposes the fixed reader-facing labels', () => {
    expect(Object.values(taskQuickFilterLabels)).toEqual([
      'All Tasks',
      'Only Ready',
      'Only Not Ready',
      'Only Rechecking',
      'Only Waiting',
    ]);
  });
});
