import type { PowerSyncDatabase } from '@powersync/web';

import {
  advanceTasksDatabaseGeneration,
  createTasksPowerSyncDatabase,
  getTasksPowerSyncDatabaseGeneration,
  TasksDatabaseSchemaCompatibilityError,
} from '@/modules/tasks/sync/database';

export const TASKS_RUNTIME_INITIALIZATION_TIMEOUT_MS = 15_000;
export const TASKS_CLOSED_CLIENT_ERROR_MESSAGE = 'Client has already been closed';
export const TASKS_RUNTIME_AUTOMATIC_RECOVERY_LIMIT = 1;
export const TASKS_CORRUPT_CACHE_AUTOMATIC_RECOVERY_LIMIT = 1;
export const TASKS_CACHE_RECOVERY_LEDGER_STORAGE_KEY =
  'bathos.tasks.cache-recovery-ledger-v1';
export const TASKS_CACHE_RECOVERY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;
export const TASKS_CACHE_RECOVERY_FALLBACK_RELEASE_ID = 'tasks-runtime-source';
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

export function isTasksDatabaseCorruptionError(error: unknown): boolean {
  const visited = new Set<unknown>();
  let candidate: unknown = error;
  let depth = 0;

  while (candidate !== null && candidate !== undefined && depth < 8) {
    if (visited.has(candidate)) return false;
    visited.add(candidate);

    if (typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      if (record.code === 11 || record.code === '11' || record.code === 'SQLITE_CORRUPT') {
        return true;
      }
      if (
        typeof record.message === 'string'
        && (record.message.includes('database disk image is malformed')
          || record.message.includes('SQLITE_CORRUPT'))
      ) {
        return true;
      }
      candidate = record.cause;
      depth += 1;
      continue;
    }

    return false;
  }

  return false;
}

export function isTasksRecoverableCacheError(error: unknown): boolean {
  return error instanceof TasksDatabaseSchemaCompatibilityError
    || isTasksDatabaseCorruptionError(error);
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

export type TasksCorruptCacheRecoveryController = {
  consumeAutomaticRecovery: (error: unknown) => boolean;
  reset: () => void;
  readonly attempts: number;
};

export function createTasksCorruptCacheRecoveryController(): TasksCorruptCacheRecoveryController {
  let attempts = 0;
  return {
    consumeAutomaticRecovery(error) {
      if (
        !isTasksRecoverableCacheError(error)
        || attempts >= TASKS_CORRUPT_CACHE_AUTOMATIC_RECOVERY_LIMIT
      ) {
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

export type TasksCorruptCacheRecoveryResult =
  | {
      outcome: 'replacement-created';
      queueCount: 0;
      previousGeneration: number;
      nextGeneration: number;
      replacement: PowerSyncDatabase;
    }
  | {
      outcome: 'queue-not-empty';
      queueCount: number;
      previousGeneration: number;
    }
  | {
      outcome: 'queue-unreadable' | 'not-eligible';
      queueCount: null;
      previousGeneration: number;
    }
  | {
      outcome: 'circuit-open';
      queueCount: 0;
      previousGeneration: number;
      reason: TasksCacheRecoveryCircuitReason;
    };

type TasksCacheRecoveryLedgerStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type TasksCacheRecoveryCircuitReason =
  | 'same-release'
  | 'cooldown-active'
  | 'ledger-unreadable'
  | 'ledger-unwritable';

export type TasksCacheRecoveryLedger = {
  version: 1;
  releaseId: string;
  recoveredAt: string;
  sourceGeneration: number;
};

export type TasksCacheRecoveryPolicy = {
  releaseId?: string;
  now?: Date;
  storage?: TasksCacheRecoveryLedgerStorage;
};

type TasksCacheRecoveryEligibility =
  | { allowed: true }
  | { allowed: false; reason: Exclude<TasksCacheRecoveryCircuitReason, 'ledger-unwritable'> };

export function resolveTasksCacheRecoveryReleaseId(): string {
  return (typeof __BATHOS_RELEASE_ID__ === 'string' ? __BATHOS_RELEASE_ID__.trim() : '')
    || (import.meta.url ? `tasks-runtime:${import.meta.url}` : TASKS_CACHE_RECOVERY_FALLBACK_RELEASE_ID);
}

export function readTasksCacheRecoveryLedger(
  storage: Pick<Storage, 'getItem'> | undefined = browserRecoveryStorage(),
): TasksCacheRecoveryLedger | null | 'unreadable' {
  if (!storage) return 'unreadable';
  try {
    const raw = storage.getItem(TASKS_CACHE_RECOVERY_LEDGER_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return 'unreadable';
    const candidate = parsed as Record<string, unknown>;
    if (
      candidate.version !== 1
      || typeof candidate.releaseId !== 'string'
      || candidate.releaseId.trim().length === 0
      || typeof candidate.recoveredAt !== 'string'
      || Number.isNaN(Date.parse(candidate.recoveredAt))
      || !Number.isSafeInteger(candidate.sourceGeneration)
      || Number(candidate.sourceGeneration) < 1
    ) {
      return 'unreadable';
    }
    return candidate as TasksCacheRecoveryLedger;
  } catch {
    return 'unreadable';
  }
}

export function evaluateTasksCacheRecoveryEligibility({
  releaseId = resolveTasksCacheRecoveryReleaseId(),
  now = new Date(),
  storage = browserRecoveryStorage(),
}: TasksCacheRecoveryPolicy = {}): TasksCacheRecoveryEligibility {
  const normalizedReleaseId = releaseId.trim();
  if (!normalizedReleaseId || Number.isNaN(now.getTime())) {
    return { allowed: false, reason: 'ledger-unreadable' };
  }
  const ledger = readTasksCacheRecoveryLedger(storage);
  if (ledger === 'unreadable') {
    return { allowed: false, reason: 'ledger-unreadable' };
  }
  if (ledger === null) return { allowed: true };
  if (ledger.releaseId === normalizedReleaseId) {
    return { allowed: false, reason: 'same-release' };
  }
  const elapsedMs = now.getTime() - Date.parse(ledger.recoveredAt);
  if (elapsedMs < TASKS_CACHE_RECOVERY_COOLDOWN_MS) {
    return { allowed: false, reason: 'cooldown-active' };
  }
  return { allowed: true };
}

export function commitTasksCacheRecoveryLedger(
  sourceGeneration: number,
  {
    releaseId = resolveTasksCacheRecoveryReleaseId(),
    now = new Date(),
    storage = browserRecoveryStorage(),
  }: TasksCacheRecoveryPolicy = {},
): boolean {
  if (!storage || !Number.isSafeInteger(sourceGeneration) || sourceGeneration < 1) {
    return false;
  }
  const normalizedReleaseId = releaseId.trim();
  if (!normalizedReleaseId || Number.isNaN(now.getTime())) return false;
  const ledger: TasksCacheRecoveryLedger = {
    version: 1,
    releaseId: normalizedReleaseId,
    recoveredAt: now.toISOString(),
    sourceGeneration,
  };
  try {
    storage.setItem(TASKS_CACHE_RECOVERY_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
    const persisted = readTasksCacheRecoveryLedger(storage);
    return persisted !== null
      && persisted !== 'unreadable'
      && persisted.version === ledger.version
      && persisted.releaseId === ledger.releaseId
      && persisted.recoveredAt === ledger.recoveredAt
      && persisted.sourceGeneration === ledger.sourceGeneration;
  } catch {
    return false;
  }
}

export async function createAutomaticCorruptTasksCacheReplacement(
  error: unknown,
  recoveryController: TasksCorruptCacheRecoveryController,
  database: Pick<PowerSyncDatabase, 'close' | 'getUploadQueueStats'> & PowerSyncDatabase,
  databaseFactory: (generation: number) => PowerSyncDatabase = createTasksPowerSyncDatabase,
  recoveryPolicy: TasksCacheRecoveryPolicy = {},
): Promise<TasksCorruptCacheRecoveryResult> {
  const previousGeneration = getTasksPowerSyncDatabaseGeneration(database);
  if (!recoveryController.consumeAutomaticRecovery(error)) {
    return {
      outcome: 'not-eligible',
      queueCount: null,
      previousGeneration,
    };
  }

  let queueCount: number;
  try {
    const queue = await database.getUploadQueueStats();
    queueCount = queue.count;
  } catch {
    return {
      outcome: 'queue-unreadable',
      queueCount: null,
      previousGeneration,
    };
  }

  if (queueCount !== 0) {
    return {
      outcome: 'queue-not-empty',
      queueCount,
      previousGeneration,
    };
  }

  const eligibility = evaluateTasksCacheRecoveryEligibility(recoveryPolicy);
  if ('reason' in eligibility) {
    return {
      outcome: 'circuit-open',
      queueCount: 0,
      previousGeneration,
      reason: eligibility.reason,
    };
  }

  if (!commitTasksCacheRecoveryLedger(previousGeneration, recoveryPolicy)) {
    return {
      outcome: 'circuit-open',
      queueCount: 0,
      previousGeneration,
      reason: 'ledger-unwritable',
    };
  }

  const advanced = advanceTasksDatabaseGeneration(previousGeneration);
  const nextGeneration = advanced.generation;
  const replacement = databaseFactory(nextGeneration);
  await database.close().catch(() => undefined);
  return {
    outcome: 'replacement-created',
    queueCount: 0,
    previousGeneration,
    nextGeneration,
    replacement,
  };
}

function browserRecoveryStorage(): TasksCacheRecoveryLedgerStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
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
