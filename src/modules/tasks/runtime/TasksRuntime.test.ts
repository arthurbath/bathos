import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitForTasksRuntimeInitialization } from './TasksRuntime';

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
