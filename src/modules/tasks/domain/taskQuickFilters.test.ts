import { describe, expect, it } from 'vitest';

import {
  getTaskQuickFilterActionabilities,
  getTaskQuickFilterForActionabilities,
  sanitizeTaskQuickFilter,
  taskMatchesQuickFilter,
  taskQuickFilterLabels,
} from '@/modules/tasks/domain/taskQuickFilters';

describe('task quick filters', () => {
  it('keeps all supported values and rejects unknown persisted values', () => {
    expect(sanitizeTaskQuickFilter('all')).toBe('all');
    expect(sanitizeTaskQuickFilter('actionable')).toBe('actionable');
    expect(sanitizeTaskQuickFilter('non_actionable')).toBe('non_actionable');
    expect(sanitizeTaskQuickFilter('actionable_waiting')).toBe('actionable_waiting');
    expect(sanitizeTaskQuickFilter('actionable_rechecking')).toBe('actionable_rechecking');
    expect(sanitizeTaskQuickFilter('rechecking')).toBe('rechecking');
    expect(sanitizeTaskQuickFilter('waiting')).toBe('waiting');
    expect(sanitizeTaskQuickFilter('blocked')).toBe('all');
    expect(sanitizeTaskQuickFilter(null)).toBe('all');
  });

  it('matches every non-empty actionability combination', () => {
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

    expect(taskMatchesQuickFilter('actionable', 'actionable_waiting')).toBe(true);
    expect(taskMatchesQuickFilter('waiting', 'actionable_waiting')).toBe(true);
    expect(taskMatchesQuickFilter('rechecking', 'actionable_waiting')).toBe(false);

    expect(taskMatchesQuickFilter('actionable', 'actionable_rechecking')).toBe(true);
    expect(taskMatchesQuickFilter('waiting', 'actionable_rechecking')).toBe(false);
    expect(taskMatchesQuickFilter('rechecking', 'actionable_rechecking')).toBe(true);
  });

  it('encodes every legal multi-select state and resets an empty state to all', () => {
    expect(getTaskQuickFilterForActionabilities([])).toBe('all');
    expect(getTaskQuickFilterForActionabilities([
      'actionable',
      'waiting',
      'rechecking',
    ])).toBe('all');
    expect(getTaskQuickFilterForActionabilities(['actionable'])).toBe('actionable');
    expect(getTaskQuickFilterForActionabilities(['waiting'])).toBe('waiting');
    expect(getTaskQuickFilterForActionabilities(['rechecking'])).toBe('rechecking');
    expect(getTaskQuickFilterForActionabilities(['waiting', 'rechecking']))
      .toBe('non_actionable');
    expect(getTaskQuickFilterForActionabilities(['waiting', 'actionable']))
      .toBe('actionable_waiting');
    expect(getTaskQuickFilterForActionabilities(['rechecking', 'actionable']))
      .toBe('actionable_rechecking');

    expect(getTaskQuickFilterActionabilities('non_actionable'))
      .toEqual(['waiting', 'rechecking']);
  });

  it('exposes concise reader-facing labels for filtered subsets', () => {
    expect(Object.values(taskQuickFilterLabels)).toEqual([
      'All Tasks',
      'Only Ready',
      'Only Waiting & Rechecking',
      'Only Ready & Waiting',
      'Only Ready & Rechecking',
      'Only Rechecking',
      'Only Waiting',
    ]);
  });
});
