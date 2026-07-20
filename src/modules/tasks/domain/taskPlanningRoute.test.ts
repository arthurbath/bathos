import { describe, expect, it } from 'vitest';

import { getTaskPlanningRoute } from './taskPlanningRoute';

describe('getTaskPlanningRoute', () => {
  it('routes terminal work to Logbook', () => {
    expect(getTaskPlanningRoute({
      destination: 'today',
      lifecycle: 'completed',
      start_date: '2026-07-20',
    }, '2026-07-20')).toBe('logbook');
  });

  it('routes future active work to Upcoming', () => {
    expect(getTaskPlanningRoute({
      destination: 'anytime',
      lifecycle: 'open',
      start_date: '2026-07-21',
    }, '2026-07-20')).toBe('upcoming');
  });

  it('retains the persisted route for currently available work', () => {
    expect(getTaskPlanningRoute({
      destination: 'anytime',
      lifecycle: 'open',
      start_date: '2026-07-20',
    }, '2026-07-20')).toBe('anytime');
  });
});
