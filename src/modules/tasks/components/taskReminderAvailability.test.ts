import { describe, expect, it } from 'vitest';

import {
  getTaskReminderAvailability,
  getTaskReminderUnavailableMessage,
} from './taskReminderAvailability';

describe('task reminder availability', () => {
  it('requires a trustworthy connected projection before enabling mutation', () => {
    expect(getTaskReminderAvailability('local', false, null)).toBe('local');
    expect(getTaskReminderAvailability('connected', true, null)).toBe('loading');
    expect(getTaskReminderAvailability('connected', false, new Error('unavailable')))
      .toBe('unavailable');
    expect(getTaskReminderAvailability('connected', false, null)).toBe('connected');
  });

  it('explains each unavailable state without exposing an underlying error', () => {
    expect(getTaskReminderUnavailableMessage('local')).toContain('connected task storage');
    expect(getTaskReminderUnavailableMessage('loading')).toContain('current schedules are known');
    expect(getTaskReminderUnavailableMessage('unavailable')).toContain('protect existing schedules');
  });
});
