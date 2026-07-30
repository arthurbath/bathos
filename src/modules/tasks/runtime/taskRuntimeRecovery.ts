import type { PowerSyncDatabase } from '@powersync/web';

import { createTasksPowerSyncDatabase } from '@/modules/tasks/sync/database';

export const TASKS_RUNTIME_INITIALIZATION_TIMEOUT_MS = 15_000;
export const TASKS_CLOSED_CLIENT_ERROR_MESSAGE = 'Client has already been closed';
export const TASKS_RUNTIME_AUTOMATIC_RECOVERY_LIMIT = 1;
export const TASKS_RUNTIME_ERROR_TITLE = 'Tasks Could Not Open';
export const TASKS_RUNTIME_ERROR_MESSAGE =
  'The tasks could not open. The issue was logged and reported to the webmaster.';

export function normalizeTasksRuntimeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unable to open local task data');
}

export function isClosedTasksRuntimeClientError(error: unknown): boolean {
  return error instanceof Error
    && error.message === TASKS_CLOSED_CLIENT_ERROR_MESSAGE;
}

export function shouldAutomaticallyRecoverTasksRuntime(
  error: unknown,
  automaticRecoveryAttempts: number,
): boolean {
  return isClosedTasksRuntimeClientError(error)
    && automaticRecoveryAttempts < TASKS_RUNTIME_AUTOMATIC_RECOVERY_LIMIT;
}

export type TasksRuntimeRecoveryController = {
  consumeAutomaticRecovery: (error: unknown) => boolean;
  reset: () => void;
  readonly attempts: number;
};

export function createTasksRuntimeRecoveryController(): TasksRuntimeRecoveryController {
  let attempts = 0;
  return {
    consumeAutomaticRecovery(error) {
      if (!shouldAutomaticallyRecoverTasksRuntime(error, attempts)) {
        return false;
      }
      attempts += 1;
      return true;
    },
    reset() {
      attempts = 0;
    },
    get attempts() {
      return attempts;
    },
  };
}

export function createAutomaticTasksRuntimeReplacement(
  error: unknown,
  recoveryController: TasksRuntimeRecoveryController,
  database: Pick<PowerSyncDatabase, 'close'>,
  databaseFactory: () => PowerSyncDatabase = createTasksPowerSyncDatabase,
): PowerSyncDatabase | null {
  if (!recoveryController.consumeAutomaticRecovery(error)) {
    return null;
  }
  const nextDatabase = databaseFactory();
  void database.close().catch(() => undefined);
  return nextDatabase;
}

export function isCurrentTasksRuntimeGeneration(
  active: boolean,
  currentGeneration: number,
  candidateGeneration: number,
): boolean {
  return active && currentGeneration === candidateGeneration;
}

export async function waitForTasksRuntimeInitialization<T>(
  initialization: Promise<T>,
  timeoutMs = TASKS_RUNTIME_INITIALIZATION_TIMEOUT_MS,
  onTimeout?: () => void,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      onTimeout?.();
      reject(new Error('Local task data took too long to open'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([initialization, deadline]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
