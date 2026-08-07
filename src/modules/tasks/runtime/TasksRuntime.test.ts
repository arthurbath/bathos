import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PowerSyncDatabase } from '@powersync/web';

import {
  createAutomaticCorruptTasksCacheReplacement,
  createAutomaticTasksRuntimeReplacement,
  createTasksCorruptCacheRecoveryController,
  createTasksRuntimeRecoveryController,
  isClosedTasksRuntimeClientError,
  isCurrentTasksRuntimeGeneration,
  isTasksDatabaseCorruptionError,
  isTasksRecoverableCacheError,
  shouldAutomaticallyRecoverTasksRuntime,
  TASKS_CLOSED_CLIENT_ERROR_MESSAGE,
  TASKS_RUNTIME_ERROR_MESSAGE,
  waitForTasksRuntimeInitialization,
} from './taskRuntimeRecovery';
import { TasksDatabaseSchemaCompatibilityError } from '@/modules/tasks/sync/database';

function createCorruptCacheDatabase({
  queueCount = 0,
  queueError,
}: {
  queueCount?: number;
  queueError?: Error;
} = {}) {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    getUploadQueueStats: queueError
      ? vi.fn().mockRejectedValue(queueError)
      : vi.fn().mockResolvedValue({ count: queueCount }),
  } as unknown as PowerSyncDatabase;
}

describe('Tasks runtime initialization watchdog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves a successful initialization result', async () => {
    await expect(
      waitForTasksRuntimeInitialization(Promise.resolve('ready'), 100),
    ).resolves.toBe('ready');
  });

  it('turns an indefinite local database wait into a recoverable failure', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const result = waitForTasksRuntimeInitialization(
      new Promise<never>(() => undefined),
      15_000,
      onTimeout,
    );

    const expectation = expect(result).rejects.toThrow(
      'Local task data took too long to open',
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await expectation;
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});

describe('Tasks runtime closed-client recovery', () => {
  it('classifies only the exact disposable-client lifecycle error', () => {
    expect(isClosedTasksRuntimeClientError(
      new Error(TASKS_CLOSED_CLIENT_ERROR_MESSAGE),
    )).toBe(true);
    expect(isClosedTasksRuntimeClientError(
      new Error('Client has already been closed while opening private task title'),
    )).toBe(false);
    expect(isClosedTasksRuntimeClientError('Client has already been closed')).toBe(false);
  });

  it('permits one automatic recovery and then stops', () => {
    const error = new Error(TASKS_CLOSED_CLIENT_ERROR_MESSAGE);

    expect(shouldAutomaticallyRecoverTasksRuntime(error, 0)).toBe(true);
    expect(shouldAutomaticallyRecoverTasksRuntime(error, 1)).toBe(false);
  });

  it('starts a new bounded recovery allowance after manual Retry resets it', () => {
    const controller = createTasksRuntimeRecoveryController();
    const error = new Error(TASKS_CLOSED_CLIENT_ERROR_MESSAGE);

    expect(controller.consumeAutomaticRecovery(error)).toBe(true);
    expect(controller.attempts).toBe(1);
    expect(controller.consumeAutomaticRecovery(error)).toBe(false);

    controller.reset();

    expect(controller.attempts).toBe(0);
    expect(controller.consumeAutomaticRecovery(error)).toBe(true);
  });

  it('retires a closed client and returns one fresh replacement without clearing storage', () => {
    const controller = createTasksRuntimeRecoveryController();
    const close = vi.fn().mockResolvedValue(undefined);
    const replacement = { replacement: true };
    const factory = vi.fn().mockReturnValue(
      replacement as unknown as PowerSyncDatabase,
    );

    const result = createAutomaticTasksRuntimeReplacement(
      new Error(TASKS_CLOSED_CLIENT_ERROR_MESSAGE),
      controller,
      { close },
      factory,
    );

    expect(result).toBe(replacement);
    expect(factory).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not rotate a second time after the automatic allowance is consumed', () => {
    const controller = createTasksRuntimeRecoveryController();
    const error = new Error(TASKS_CLOSED_CLIENT_ERROR_MESSAGE);
    const close = vi.fn().mockResolvedValue(undefined);
    const firstFactory = vi.fn().mockReturnValue(
      { first: true } as unknown as PowerSyncDatabase,
    );
    const secondFactory = vi.fn().mockReturnValue(
      { second: true } as unknown as PowerSyncDatabase,
    );

    expect(createAutomaticTasksRuntimeReplacement(
      error,
      controller,
      { close },
      firstFactory,
    )).not.toBeNull();
    expect(createAutomaticTasksRuntimeReplacement(
      error,
      controller,
      { close },
      secondFactory,
    )).toBeNull();
    expect(secondFactory).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects state updates from inactive and retired generations', () => {
    expect(isCurrentTasksRuntimeGeneration(true, 3, 3)).toBe(true);
    expect(isCurrentTasksRuntimeGeneration(false, 3, 3)).toBe(false);
    expect(isCurrentTasksRuntimeGeneration(true, 4, 3)).toBe(false);
  });

  it('keeps implementation details out of the user-facing fallback message', () => {
    expect(TASKS_RUNTIME_ERROR_MESSAGE).toBe(
      'The tasks could not open. The issue was logged and reported to the webmaster.',
    );
    expect(TASKS_RUNTIME_ERROR_MESSAGE).not.toContain(
      TASKS_CLOSED_CLIENT_ERROR_MESSAGE,
    );
  });
});

describe('Tasks corrupt synchronized-cache recovery', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('classifies only established SQLite corruption signatures and causal chains', () => {
    expect(isTasksDatabaseCorruptionError(
      new Error('database disk image is malformed'),
    )).toBe(true);
    expect(isTasksDatabaseCorruptionError({ code: 'SQLITE_CORRUPT' })).toBe(true);
    expect(isTasksDatabaseCorruptionError({ code: 11 })).toBe(true);
    const causalError = Object.assign(new Error('PowerSync download failed'), {
      cause: { message: 'SQLITE_CORRUPT: malformed page graph' },
    });
    expect(isTasksDatabaseCorruptionError(causalError)).toBe(true);
    expect(isTasksDatabaseCorruptionError(new Error('Network unavailable'))).toBe(false);
  });

  it('classifies a legacy schema mismatch for the same queue-safe cache replacement', () => {
    expect(isTasksRecoverableCacheError(
      new TasksDatabaseSchemaCompatibilityError(
        new Error('no such column: action_id'),
      ),
    )).toBe(true);
    expect(isTasksRecoverableCacheError(new Error('Network unavailable'))).toBe(false);
  });

  it('rotates a legacy cache only after proving its upload queue is empty', async () => {
    const controller = createTasksCorruptCacheRecoveryController();
    const database = createCorruptCacheDatabase();
    const replacement = { replacement: true } as unknown as PowerSyncDatabase;
    const factory = vi.fn().mockReturnValue(replacement);

    await expect(createAutomaticCorruptTasksCacheReplacement(
      new TasksDatabaseSchemaCompatibilityError(new Error('no such column: action_id')),
      controller,
      database,
      factory,
    )).resolves.toMatchObject({
      outcome: 'replacement-created',
      queueCount: 0,
      previousGeneration: 1,
      nextGeneration: 2,
    });
  });

  it('rotates to one fresh generation only after proving the upload queue is empty', async () => {
    const controller = createTasksCorruptCacheRecoveryController();
    const database = createCorruptCacheDatabase();
    const replacement = { replacement: true } as unknown as PowerSyncDatabase;
    const factory = vi.fn().mockReturnValue(replacement);

    await expect(createAutomaticCorruptTasksCacheReplacement(
      new Error('database disk image is malformed'),
      controller,
      database,
      factory,
    )).resolves.toEqual({
      outcome: 'replacement-created',
      queueCount: 0,
      previousGeneration: 1,
      nextGeneration: 2,
      replacement,
    });
    expect(factory).toHaveBeenCalledWith(2);
    expect(database.close).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem('bathos.tasks.database-generation')).toBe('2');
  });

  it('preserves the current namespace when local mutations remain queued', async () => {
    const controller = createTasksCorruptCacheRecoveryController();
    const database = createCorruptCacheDatabase({ queueCount: 2 });
    const factory = vi.fn();

    await expect(createAutomaticCorruptTasksCacheReplacement(
      { code: 'SQLITE_CORRUPT' },
      controller,
      database,
      factory,
    )).resolves.toEqual({
      outcome: 'queue-not-empty',
      queueCount: 2,
      previousGeneration: 1,
    });
    expect(factory).not.toHaveBeenCalled();
    expect(database.close).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('bathos.tasks.database-generation')).toBeNull();
  });

  it('fails closed when queue safety cannot be read', async () => {
    const controller = createTasksCorruptCacheRecoveryController();
    const database = createCorruptCacheDatabase({
      queueError: new Error('queue unavailable'),
    });

    await expect(createAutomaticCorruptTasksCacheReplacement(
      { code: 11 },
      controller,
      database,
      vi.fn(),
    )).resolves.toEqual({
      outcome: 'queue-unreadable',
      queueCount: null,
      previousGeneration: 1,
    });
    expect(database.close).not.toHaveBeenCalled();
  });

  it('allows only one automatic corrupt-cache recovery per runtime cycle', async () => {
    const controller = createTasksCorruptCacheRecoveryController();
    const database = createCorruptCacheDatabase({ queueCount: 0 });
    const factory = vi.fn().mockReturnValue({} as PowerSyncDatabase);
    const error = new Error('database disk image is malformed');

    expect((await createAutomaticCorruptTasksCacheReplacement(
      error,
      controller,
      database,
      factory,
    )).outcome).toBe('replacement-created');
    await expect(createAutomaticCorruptTasksCacheReplacement(
      error,
      controller,
      database,
      factory,
    )).resolves.toMatchObject({ outcome: 'not-eligible' });
    expect(factory).toHaveBeenCalledOnce();
  });
});
