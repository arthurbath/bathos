import * as Sentry from '@sentry/react';

export type TasksRuntimeCacheRecoveryOutcome =
  | 'replacement-created'
  | 'queue-not-empty'
  | 'queue-unreadable'
  | 'circuit-open'
  | 'replacement-failed';

export type TasksRuntimeCacheRecoveryCircuitReason =
  | 'same-release'
  | 'cooldown-active'
  | 'ledger-unreadable'
  | 'ledger-unwritable';

export type TasksRuntimeCacheRecoveryReport = {
  event: 'tasks-runtime-cache-recovery';
  timestamp: string;
  failureClass: 'sqlite-corruption' | 'schema-incompatible';
  queueSafety: 'empty' | 'nonempty' | 'unreadable';
  previousGeneration: number;
  nextGeneration: number | null;
  outcome: TasksRuntimeCacheRecoveryOutcome;
  circuitReason: TasksRuntimeCacheRecoveryCircuitReason | null;
  sentryEventId: string | null;
};

export const TASKS_RUNTIME_CACHE_RECOVERY_STORAGE_KEY = 'bathos.tasks.cache-recoveries';
export const TASKS_RUNTIME_CACHE_RECOVERY_RETENTION = 10;

type TasksRuntimeCacheRecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function reportTasksRuntimeCacheRecovery(
  report: Omit<
    TasksRuntimeCacheRecoveryReport,
    'event' | 'timestamp' | 'sentryEventId' | 'circuitReason'
  > & { circuitReason?: TasksRuntimeCacheRecoveryCircuitReason | null },
  storage: TasksRuntimeCacheRecoveryStorage | undefined = browserStorage(),
): TasksRuntimeCacheRecoveryReport {
  const safeReport: TasksRuntimeCacheRecoveryReport = {
    event: 'tasks-runtime-cache-recovery',
    timestamp: new Date().toISOString(),
    failureClass: report.failureClass,
    queueSafety: report.queueSafety,
    previousGeneration: report.previousGeneration,
    nextGeneration: report.nextGeneration,
    outcome: report.outcome,
    circuitReason: report.circuitReason ?? null,
    sentryEventId: null,
  };
  safeReport.sentryEventId = Sentry.getClient()
    ? Sentry.captureMessage('Tasks local cache recovery', {
        level: report.outcome === 'replacement-created' ? 'warning' : 'error',
        tags: {
          module: 'tasks',
          operation: 'local-cache-recovery',
          failure_class: safeReport.failureClass,
          queue_safety: safeReport.queueSafety,
          recovery_outcome: safeReport.outcome,
          recovery_circuit_reason: safeReport.circuitReason ?? 'none',
        },
        contexts: {
          tasks_cache_recovery: {
            previousGeneration: safeReport.previousGeneration,
            nextGeneration: safeReport.nextGeneration,
            queueSafety: safeReport.queueSafety,
            outcome: safeReport.outcome,
            circuitReason: safeReport.circuitReason,
          },
        },
      })
    : null;

  console.warn('[Tasks] Local synchronized cache recovery', safeReport);
  persistTasksRuntimeCacheRecoveryReport(safeReport, storage);
  return safeReport;
}

export function readTasksRuntimeCacheRecoveryReports(
  storage: Pick<Storage, 'getItem'> | undefined = browserStorage(),
): TasksRuntimeCacheRecoveryReport[] {
  if (!storage) return [];
  try {
    const value = storage.getItem(TASKS_RUNTIME_CACHE_RECOVERY_STORAGE_KEY);
    if (value === null) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseTasksRuntimeCacheRecoveryReport)
      .filter((report): report is TasksRuntimeCacheRecoveryReport => report !== null)
      .slice(0, TASKS_RUNTIME_CACHE_RECOVERY_RETENTION);
  } catch {
    return [];
  }
}

function persistTasksRuntimeCacheRecoveryReport(
  report: TasksRuntimeCacheRecoveryReport,
  storage: TasksRuntimeCacheRecoveryStorage | undefined,
) {
  if (!storage) return;
  try {
    const reports = [report, ...readTasksRuntimeCacheRecoveryReports(storage)]
      .slice(0, TASKS_RUNTIME_CACHE_RECOVERY_RETENTION);
    storage.setItem(TASKS_RUNTIME_CACHE_RECOVERY_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Diagnostics must never interrupt cache recovery.
  }
}

function parseTasksRuntimeCacheRecoveryReport(
  value: unknown,
): TasksRuntimeCacheRecoveryReport | null {
  if (value === null || typeof value !== 'object') return null;
  const report = value as Record<string, unknown>;
  if (
    report.event !== 'tasks-runtime-cache-recovery'
    || (report.failureClass !== 'sqlite-corruption'
      && report.failureClass !== 'schema-incompatible')
    || (report.queueSafety !== 'empty'
      && report.queueSafety !== 'nonempty'
      && report.queueSafety !== 'unreadable')
    || (report.outcome !== 'replacement-created'
      && report.outcome !== 'queue-not-empty'
      && report.outcome !== 'queue-unreadable'
      && report.outcome !== 'circuit-open'
      && report.outcome !== 'replacement-failed')
    || (report.circuitReason !== undefined
      && report.circuitReason !== null
      && report.circuitReason !== 'same-release'
      && report.circuitReason !== 'cooldown-active'
      && report.circuitReason !== 'ledger-unreadable'
      && report.circuitReason !== 'ledger-unwritable')
    || typeof report.timestamp !== 'string'
    || Number.isNaN(Date.parse(report.timestamp))
    || !Number.isSafeInteger(report.previousGeneration)
    || (report.nextGeneration !== null && !Number.isSafeInteger(report.nextGeneration))
    || (report.sentryEventId !== null && typeof report.sentryEventId !== 'string')
  ) {
    return null;
  }
  return {
    ...report,
    circuitReason: report.circuitReason ?? null,
  } as TasksRuntimeCacheRecoveryReport;
}

function browserStorage(): TasksRuntimeCacheRecoveryStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
