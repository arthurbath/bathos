import { describe, expect, it } from 'vitest';

import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import {
  cycleTaskShortcutHorizon,
  getTaskTodayShortcutHorizon,
} from './taskShortcutPlanning';

describe('task shortcut planning', () => {
  it('cycles only Now, Next, and Later', () => {
    expect(cycleTaskShortcutHorizon(null)).toBe('now');
    expect(cycleTaskShortcutHorizon('inbox')).toBe('now');
    expect(cycleTaskShortcutHorizon('now')).toBe('next');
    expect(cycleTaskShortcutHorizon('next')).toBe('later');
    expect(cycleTaskShortcutHorizon('later')).toBe('now');
  });

  it('moves outside work to Now and cycles current Today work', () => {
    expect(getTaskTodayShortcutHorizon(taskTodoFixture({
      destination: 'someday',
      today_section: null,
      start_date: null,
    }), '2026-07-22')).toBe('now');
    expect(getTaskTodayShortcutHorizon(taskTodoFixture({
      destination: 'anytime',
      today_section: 'now',
      start_date: null,
    }), '2026-07-22')).toBe('next');
    expect(getTaskTodayShortcutHorizon(taskTodoFixture({
      destination: 'anytime',
      today_section: 'later',
      start_date: '2026-07-23',
    }), '2026-07-22')).toBe('now');
  });
});
