import { describe, expect, it } from 'vitest';

import { taskHasReminderEligibleStart } from './taskReminderEligibility';

const planningDate = '2026-08-05';

describe('taskHasReminderEligibleStart', () => {
  it('accepts every Today horizon and future Start date', () => {
    expect(taskHasReminderEligibleStart({
      destination: 'anytime', start_date: null, today_section: 'inbox',
    }, planningDate)).toBe(true);
    expect(taskHasReminderEligibleStart({
      destination: 'anytime', start_date: '2026-08-06', today_section: null,
    }, planningDate)).toBe(true);
  });

  it('rejects horizon-free Anytime, Someday, and reached explicit dates', () => {
    expect(taskHasReminderEligibleStart({
      destination: 'anytime', start_date: null, today_section: null,
    }, planningDate)).toBe(false);
    expect(taskHasReminderEligibleStart({
      destination: 'someday', start_date: null, today_section: null,
    }, planningDate)).toBe(false);
    expect(taskHasReminderEligibleStart({
      destination: 'anytime', start_date: planningDate, today_section: null,
    }, planningDate)).toBe(false);
  });
});
