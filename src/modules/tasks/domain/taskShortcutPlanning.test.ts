import { describe, expect, it } from 'vitest';

import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import {
  cycleTaskShortcutHorizon,
  getBulkTaskTodayShortcutHorizon,
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
      today_section: null,
      start_date: '2026-07-23',
    }), '2026-07-22')).toBe('now');
  });

  it('normalizes mixed bulk horizons to Now before advancing a shared state', () => {
    const taskAt = (todaySection: 'now' | 'next' | 'later') => taskTodoFixture({
      destination: 'anytime',
      today_section: todaySection,
      start_date: null,
    });

    expect(getBulkTaskTodayShortcutHorizon([
      taskAt('now'),
      taskAt('next'),
      taskAt('later'),
    ], '2026-07-22')).toBe('now');
    expect(getBulkTaskTodayShortcutHorizon([
      taskAt('now'),
      taskAt('now'),
    ], '2026-07-22')).toBe('next');
    expect(getBulkTaskTodayShortcutHorizon([
      taskAt('next'),
      taskAt('next'),
    ], '2026-07-22')).toBe('later');
    expect(getBulkTaskTodayShortcutHorizon([
      taskAt('later'),
      taskAt('later'),
    ], '2026-07-22')).toBe('now');
  });

  it('normalizes Inbox and work outside Today to Now in bulk', () => {
    expect(getBulkTaskTodayShortcutHorizon([
      taskTodoFixture({
        destination: 'anytime',
        today_section: 'inbox',
        start_date: null,
      }),
      taskTodoFixture({
        destination: 'someday',
        today_section: null,
        start_date: null,
      }),
      taskTodoFixture({
        destination: 'anytime',
        today_section: null,
        start_date: '2026-07-23',
      }),
    ], '2026-07-22')).toBe('now');
  });
});
