import { describe, expect, it } from 'vitest';

import { getTaskPlanningRoute } from './taskPlanningRoute';

describe('getTaskPlanningRoute', () => {
  it('routes terminal work to Done', () => {
    expect(getTaskPlanningRoute({
      destination: 'anytime',
      lifecycle: 'completed',
      disposition: 'present',
      today_section: 'none',
      start_date: '2026-07-20',
    }, '2026-07-20')).toBe('done');
  });

  it('routes future active work to Upcoming', () => {
    expect(getTaskPlanningRoute({
      destination: 'anytime',
      lifecycle: 'open',
      disposition: 'present',
      today_section: 'none',
      start_date: '2026-07-21',
    }, '2026-07-20')).toBe('upcoming');
  });

  it('retains the persisted route for currently available work', () => {
    expect(getTaskPlanningRoute({
      destination: 'anytime',
      lifecycle: 'open',
      disposition: 'present',
      start_date: '2026-07-20',
      today_section: 'none',
    }, '2026-07-20')).toBe('anytime');
  });
});
