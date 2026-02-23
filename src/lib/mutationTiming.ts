import * as Sentry from '@sentry/react';

type MutationStatus = 'success' | 'error';

export interface MutationTimingRecord {
  id: string;
  module: string;
  action: string;
  status: MutationStatus;
  requestCount: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  serverDurationMs?: number;
  errorMessage?: string;
}

interface MutationTimingOptions {
  module: string;
  action: string;
  requestCount?: number;
  serverDurationMs?: number;
}

const MAX_TIMING_RECORDS = 200;
const records: MutationTimingRecord[] = [];

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function pushRecord(record: MutationTimingRecord): void {
  records.push(record);
  if (records.length > MAX_TIMING_RECORDS) {
    records.splice(0, records.length - MAX_TIMING_RECORDS);
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function logRecord(record: MutationTimingRecord): void {
  const label = `[timing][${record.module}] ${record.action}`;
  const summary = `${label} ${record.status} in ${Math.round(record.durationMs)}ms (requests=${record.requestCount})`;

  if (record.status === 'error') {
    console.warn(summary, record.errorMessage ?? 'unknown error');
  } else if (import.meta.env.DEV) {
    console.debug(summary);
  }

  Sentry.addBreadcrumb({
    category: 'mutation.timing',
    level: record.status === 'error' ? 'warning' : 'info',
    message: summary,
    data: {
      module: record.module,
      action: record.action,
      status: record.status,
      requestCount: record.requestCount,
      durationMs: Math.round(record.durationMs),
      serverDurationMs: record.serverDurationMs,
      errorMessage: record.errorMessage,
    },
  });
}

export function getMutationTimingRecords(): MutationTimingRecord[] {
  return records.slice();
}

export async function withMutationTiming<T>(
  options: MutationTimingOptions,
  run: () => Promise<T>,
): Promise<T> {
  const requestCount = Math.max(1, options.requestCount ?? 1);
  const startedAt = new Date().toISOString();
  const startMs = nowMs();

  try {
    const result = await run();
    const endedAt = new Date().toISOString();
    const durationMs = nowMs() - startMs;

    const record: MutationTimingRecord = {
      id: crypto.randomUUID(),
      module: options.module,
      action: options.action,
      status: 'success',
      requestCount,
      startedAt,
      endedAt,
      durationMs,
      serverDurationMs: options.serverDurationMs,
    };

    pushRecord(record);
    logRecord(record);

    return result;
  } catch (error: unknown) {
    const endedAt = new Date().toISOString();
    const durationMs = nowMs() - startMs;

    const record: MutationTimingRecord = {
      id: crypto.randomUUID(),
      module: options.module,
      action: options.action,
      status: 'error',
      requestCount,
      startedAt,
      endedAt,
      durationMs,
      serverDurationMs: options.serverDurationMs,
      errorMessage: toErrorMessage(error),
    };

    pushRecord(record);
    logRecord(record);
    throw error;
  }
}
