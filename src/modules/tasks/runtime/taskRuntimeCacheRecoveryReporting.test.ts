import * as Sentry from '@sentry/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readTasksRuntimeCacheRecoveryReports,
  reportTasksRuntimeCacheRecovery,
  TASKS_RUNTIME_CACHE_RECOVERY_STORAGE_KEY,
} from './taskRuntimeCacheRecoveryReporting';

vi.mock('@sentry/react', () => ({
  captureMessage: vi.fn(() => 'cache-recovery-event'),
  getClient: vi.fn(() => ({})),
}));

describe('Tasks runtime cache recovery reporting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('reports only bounded cache and queue state without task or owner content', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const report = reportTasksRuntimeCacheRecovery({
      failureClass: 'sqlite-corruption',
      queueSafety: 'empty',
      previousGeneration: 1,
      nextGeneration: 2,
      outcome: 'replacement-created',
    });

    expect(report).toMatchObject({
      event: 'tasks-runtime-cache-recovery',
      failureClass: 'sqlite-corruption',
      queueSafety: 'empty',
      previousGeneration: 1,
      nextGeneration: 2,
      outcome: 'replacement-created',
      sentryEventId: 'cache-recovery-event',
    });
    expect(JSON.stringify(report)).not.toMatch(/owner|task_id|title|database contents/i);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Tasks local cache recovery',
      expect.objectContaining({ level: 'warning' }),
    );
    expect(readTasksRuntimeCacheRecoveryReports()).toEqual([report]);
  });

  it('ignores malformed stored diagnostics instead of exposing arbitrary fields', () => {
    window.localStorage.setItem(
      TASKS_RUNTIME_CACHE_RECOVERY_STORAGE_KEY,
      JSON.stringify([{ title: 'Private Task', ownerId: 'private-owner' }]),
    );

    expect(readTasksRuntimeCacheRecoveryReports()).toEqual([]);
  });

  it('preserves the schema-incompatible failure classification', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const report = reportTasksRuntimeCacheRecovery({
      failureClass: 'schema-incompatible',
      queueSafety: 'empty',
      previousGeneration: 4,
      nextGeneration: 5,
      outcome: 'replacement-created',
    });

    expect(report.failureClass).toBe('schema-incompatible');
    expect(readTasksRuntimeCacheRecoveryReports()[0]?.failureClass)
      .toBe('schema-incompatible');
  });

  it('records a content-free persistent circuit-open outcome', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const report = reportTasksRuntimeCacheRecovery({
      failureClass: 'sqlite-corruption',
      queueSafety: 'empty',
      previousGeneration: 3,
      nextGeneration: null,
      outcome: 'circuit-open',
      circuitReason: 'cooldown-active',
    });

    expect(report).toMatchObject({
      outcome: 'circuit-open',
      circuitReason: 'cooldown-active',
    });
    expect(JSON.stringify(report)).not.toMatch(/owner|task_id|title|database contents/i);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Tasks local cache recovery',
      expect.objectContaining({ level: 'error' }),
    );
  });
});
