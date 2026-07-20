import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskRecurrenceDefinitionFixture,
  taskRecurrenceOccurrenceFixture,
  taskRecurrenceRevisionFixture,
} from '@/modules/tasks/testing/taskFixtures';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';
import { useTaskRecurrences } from './useTaskRecurrences';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

const planningTimeZone = 'America/Los_Angeles';
let definitionRows: TaskRecurrenceDefinition[];
let revisionRows: TaskRecurrenceRevision[];
let occurrenceRows: TaskRecurrenceOccurrence[];

describe('useTaskRecurrences', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T00:30:00.000Z'));
    definitionRows = [];
    revisionRows = [];
    occurrenceRows = [];
    mocks.useQuery.mockReset().mockImplementation((query: string) => ({
      data: query.includes('tasks_recurrence_revisions')
        ? revisionRows
        : query.includes('tasks_recurrence_definitions') ? definitionRows : occurrenceRows,
      isLoading: false,
      error: null,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives the owner-local planning date and evaluates an overdue active definition once', async () => {
    const stale = taskRecurrenceDefinitionFixture({ evaluated_through_date: '2026-07-18' });
    const evaluated = taskRecurrenceDefinitionFixture({
      evaluated_through_date: '2026-07-19',
      record_revision: 2,
      client_mutation_id: 'mutation-recurrence-evaluated',
    });
    const recurrenceService = {
      evaluate: vi.fn().mockResolvedValue({
        outcome: 'accepted',
        status: 'active',
        through_date: '2026-07-19',
        generated_count: 1,
        occurrence_ids: ['recurrence-occurrence-a'],
        definition: evaluated,
      }),
      save: vi.fn(),
      setStatus: vi.fn(),
    };
    definitionRows = [stale];
    revisionRows = [taskRecurrenceRevisionFixture()];
    occurrenceRows = [taskRecurrenceOccurrenceFixture()];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      recurrenceService,
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    expect(result.current.planningDate).toBe('2026-07-19');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(recurrenceService.evaluate).toHaveBeenCalledTimes(1);
    expect(recurrenceService.evaluate).toHaveBeenCalledWith(stale.id, '2026-07-19');
    expect(result.current.definitions[0]).toEqual(evaluated);
  });

  it('passes the planning time zone to saves and immediately evaluates due active work', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      evaluated_through_date: '2026-07-18',
      client_mutation_id: 'mutation-saved-recurrence',
    });
    const revision = taskRecurrenceRevisionFixture({
      client_mutation_id: 'mutation-saved-recurrence',
    });
    const recurrenceService = {
      save: vi.fn().mockResolvedValue({ outcome: 'accepted', definition, revision }),
      evaluate: vi.fn().mockResolvedValue({
        outcome: 'accepted',
        status: 'active',
        through_date: '2026-07-19',
        generated_count: 1,
        occurrence_ids: ['recurrence-occurrence-a'],
        definition: { ...definition, evaluated_through_date: '2026-07-19' },
      }),
      setStatus: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      recurrenceService,
    });
    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    await act(async () => {
      await result.current.save({
        name: 'Daily Review',
        templateId: 'template-a',
        templateRevision: 1,
        ruleMode: 'calendar',
        frequency: 'daily',
        intervalCount: 1,
        startDate: '2026-07-19',
        missedPolicy: 'latest',
      });
    });

    expect(recurrenceService.save).toHaveBeenCalledWith(expect.objectContaining({
      planningTimeZone,
      startDate: '2026-07-19',
    }));
    expect(recurrenceService.evaluate).toHaveBeenCalledWith(definition.id, '2026-07-19');
    expect(result.current.revisions.get(definition.id)).toEqual(revision);
  });

  it('keeps an accepted save successful while exposing a failed catch-up for explicit retry', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      evaluated_through_date: '2026-07-18',
      client_mutation_id: 'mutation-saved-recurrence',
    });
    const revision = taskRecurrenceRevisionFixture({
      client_mutation_id: 'mutation-saved-recurrence',
    });
    const evaluated = {
      ...definition,
      evaluated_through_date: '2026-07-19',
    };
    const recurrenceService = {
      save: vi.fn().mockResolvedValue({ outcome: 'accepted', definition, revision }),
      evaluate: vi.fn()
        .mockRejectedValueOnce(new Error('catch-up unavailable'))
        .mockResolvedValue({
          outcome: 'accepted',
          status: 'active',
          through_date: '2026-07-19',
          generated_count: 1,
          occurrence_ids: ['recurrence-occurrence-a'],
          definition: evaluated,
        }),
      setStatus: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      recurrenceService,
    });
    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    let saveResult: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      saveResult = await result.current.save({
        name: 'Daily Review',
        templateId: 'template-a',
        templateRevision: 1,
        ruleMode: 'calendar',
        frequency: 'daily',
        intervalCount: 1,
        startDate: '2026-07-19',
        missedPolicy: 'latest',
      });
    });

    expect(saveResult?.outcome).toBe('accepted');
    expect(result.current.evaluationFailures.has(definition.id)).toBe(true);

    await act(async () => {
      await result.current.evaluate(definition);
    });
    expect(recurrenceService.evaluate).toHaveBeenCalledTimes(2);
    expect(result.current.evaluationFailures.has(definition.id)).toBe(false);
    expect(result.current.definitions[0]).toEqual(evaluated);
  });

  it('reports an automatic evaluation failure once without entering a retry loop', async () => {
    const stale = taskRecurrenceDefinitionFixture({ evaluated_through_date: '2026-07-18' });
    const recurrenceService = {
      evaluate: vi.fn().mockRejectedValue(new Error('catch-up unavailable')),
      save: vi.fn(),
      setStatus: vi.fn(),
    };
    definitionRows = [stale];
    revisionRows = [taskRecurrenceRevisionFixture()];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      recurrenceService,
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recurrenceService.evaluate).toHaveBeenCalledTimes(1);
    expect(result.current.evaluationFailures.has(stale.id)).toBe(true);
  });

  it('keeps recurrence mutations unavailable in local-only mode', async () => {
    const recurrenceService = {
      save: vi.fn(),
      evaluate: vi.fn(),
      setStatus: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local',
      planningTimeZone,
      recurrenceService,
    });
    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    await expect(result.current.evaluate(taskRecurrenceDefinitionFixture())).rejects.toThrow(
      'Recurrence evaluation requires connected task storage',
    );
    expect(recurrenceService.evaluate).not.toHaveBeenCalled();
  });
});
