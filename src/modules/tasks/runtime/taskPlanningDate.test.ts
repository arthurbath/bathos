import { describe, expect, it } from 'vitest';

import {
  TASKS_ACTIVE_QUEUE_POLL_MS,
  TASKS_IDLE_QUEUE_POLL_MS,
  shouldActivateTaskPlanningDate,
  taskQueuePollDelay,
} from '@/modules/tasks/runtime/taskPlanningDate';

describe('Tasks runtime background scheduling', () => {
  it('activates planning work on startup and only when the calendar date changes', () => {
    expect(shouldActivateTaskPlanningDate(null, '2026-08-07')).toBe(true);
    expect(shouldActivateTaskPlanningDate('2026-08-07', '2026-08-07')).toBe(false);
    expect(shouldActivateTaskPlanningDate('2026-08-07', '2026-08-08')).toBe(true);
  });

  it('polls actively only while uploads remain queued', () => {
    expect(taskQueuePollDelay(3)).toBe(TASKS_ACTIVE_QUEUE_POLL_MS);
    expect(taskQueuePollDelay(0)).toBe(TASKS_IDLE_QUEUE_POLL_MS);
  });
});
