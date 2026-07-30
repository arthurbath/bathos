import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PowerSyncDatabase } from '@powersync/web';

import {
  createAutomaticTasksRuntimeReplacement,
  createTasksRuntimeRecoveryController,
  isClosedTasksRuntimeClientError,
  isCurrentTasksRuntimeGeneration,
  shouldAutomaticallyRecoverTasksRuntime,
  TASKS_CLOSED_CLIENT_ERROR_MESSAGE,
  TASKS_RUNTIME_ERROR_MESSAGE,
  waitForTasksRuntimeInitialization,
} from './taskRuntimeRecovery';

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
