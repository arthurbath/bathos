import { describe, expect, it, vi } from 'vitest';

import { activateTaskPlanningDate } from './taskPlanningDate';

describe('TasksRuntime planning-date activation', () => {
  it('rolls prior-day tasks before activating reached task and project Starts', async () => {
    const rolloverTodayTasks = vi.fn().mockResolvedValue([]);
    const activateDueStartDates = vi.fn().mockResolvedValue([]);
    const activateDueProjectStartDates = vi.fn().mockResolvedValue([]);

    await activateTaskPlanningDate({
      ownerId: 'owner-a',
      planningDate: '2026-07-25',
      planningTimeZone: 'America/Los_Angeles',
      repository: {
        rolloverTodayTasks,
        activateDueStartDates,
      },
      hierarchyRepository: {
        activateDueProjectStartDates,
      },
    });

    expect(rolloverTodayTasks).toHaveBeenCalledWith(
      'owner-a',
      '2026-07-25',
      'America/Los_Angeles',
    );
    expect(activateDueStartDates).toHaveBeenCalledWith('owner-a', '2026-07-25');
    expect(activateDueProjectStartDates).toHaveBeenCalledWith(
      'owner-a',
      '2026-07-25',
    );
    expect(rolloverTodayTasks.mock.invocationCallOrder[0]).toBeLessThan(
      activateDueStartDates.mock.invocationCallOrder[0],
    );
    expect(activateDueStartDates.mock.invocationCallOrder[0]).toBeLessThan(
      activateDueProjectStartDates.mock.invocationCallOrder[0],
    );
  });
});
