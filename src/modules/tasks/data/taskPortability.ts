import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/integrations/supabase/types';
import type { TaskHistoryEvent } from '@/modules/tasks/domain/taskHistory';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskExportV1 = {
  format: 'garden.bath.tasks.export';
  schema_version: 1;
  created_at: string;
  manifest: {
    collections: ['tasks_todos', 'tasks_history_events'];
    counts: {
      tasks_todos: number;
      tasks_history_events: number;
    };
    checksums: {
      algorithm: 'sha256';
      tasks_todos: string;
      tasks_history_events: string;
    };
  };
  data: {
    tasks_todos: Array<Omit<TaskTodo, 'owner_id'>>;
    tasks_history_events: Array<Omit<TaskHistoryEvent, 'owner_id'>>;
  };
};

export type TaskRestoreCollectionReport = {
  inserts: number;
  matches: number;
  conflicts: number;
  insert_ids: string[];
  match_ids: string[];
  conflict_ids: string[];
};

export type TaskRestoreReport = {
  dry_run: boolean;
  schema_version: 1;
  tasks_todos: TaskRestoreCollectionReport;
  tasks_history_events: TaskRestoreCollectionReport;
};

type TaskPortabilityClient = Pick<SupabaseClient<Database>, 'rpc'>;

export class InvalidTaskExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskExportError';
  }
}

export async function createTaskExport(
  supabase: TaskPortabilityClient,
): Promise<TaskExportV1> {
  const { data, error } = await supabase.rpc('tasks_create_export_v1');
  if (error) {
    throw error;
  }
  return parseTaskExport(data);
}

export async function previewTaskRestore(
  supabase: TaskPortabilityClient,
  taskExport: TaskExportV1,
): Promise<TaskRestoreReport> {
  return restoreTaskExport(supabase, taskExport, true);
}

export async function mergeTaskRestore(
  supabase: TaskPortabilityClient,
  taskExport: TaskExportV1,
): Promise<TaskRestoreReport> {
  return restoreTaskExport(supabase, taskExport, false);
}

export function serializeTaskExport(taskExport: TaskExportV1): string {
  return `${JSON.stringify(taskExport, null, 2)}\n`;
}

export function getTaskExportFilename(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.valueOf())) {
    throw new InvalidTaskExportError('Task export contains an invalid creation time');
  }
  return `bathos-tasks-${date.toISOString().slice(0, 10)}.json`;
}

export function parseTaskExport(value: unknown): TaskExportV1 {
  const record = requireRecord(value, 'Task export must be a JSON object');
  if (record.format !== 'garden.bath.tasks.export' || record.schema_version !== 1) {
    throw new InvalidTaskExportError('Task export format or schema version is unsupported');
  }

  const manifest = requireRecord(record.manifest, 'Task export manifest is invalid');
  const counts = requireRecord(manifest.counts, 'Task export counts are invalid');
  const checksums = requireRecord(manifest.checksums, 'Task export checksums are invalid');
  const data = requireRecord(record.data, 'Task export data is invalid');
  const tasks = requireArray(data.tasks_todos, 'Task export tasks are invalid');
  const history = requireArray(data.tasks_history_events, 'Task export history is invalid');
  const collections = requireArray(manifest.collections, 'Task export collections are invalid');

  if (
    typeof record.created_at !== 'string'
    || collections.length !== 2
    || collections[0] !== 'tasks_todos'
    || collections[1] !== 'tasks_history_events'
    || counts.tasks_todos !== tasks.length
    || counts.tasks_history_events !== history.length
    || checksums.algorithm !== 'sha256'
    || !isSha256(checksums.tasks_todos)
    || !isSha256(checksums.tasks_history_events)
  ) {
    throw new InvalidTaskExportError('Task export manifest does not match its data');
  }

  return value as TaskExportV1;
}

function parseTaskRestoreReport(value: unknown): TaskRestoreReport {
  const report = requireRecord(value, 'Task restore report is invalid');
  if (typeof report.dry_run !== 'boolean' || report.schema_version !== 1) {
    throw new InvalidTaskExportError('Task restore report metadata is invalid');
  }
  parseCollectionReport(report.tasks_todos);
  parseCollectionReport(report.tasks_history_events);
  return value as TaskRestoreReport;
}

async function restoreTaskExport(
  supabase: TaskPortabilityClient,
  taskExport: TaskExportV1,
  dryRun: boolean,
): Promise<TaskRestoreReport> {
  const validatedExport = parseTaskExport(taskExport);
  const { data, error } = await supabase.rpc('tasks_restore_export_v1', {
    _envelope: validatedExport as unknown as Json,
    _dry_run: dryRun,
  });
  if (error) {
    throw error;
  }
  return parseTaskRestoreReport(data);
}

function parseCollectionReport(value: unknown): TaskRestoreCollectionReport {
  const report = requireRecord(value, 'Task restore collection report is invalid');
  const insertIds = requireStringArray(report.insert_ids);
  const matchIds = requireStringArray(report.match_ids);
  const conflictIds = requireStringArray(report.conflict_ids);
  if (
    report.inserts !== insertIds.length
    || report.matches !== matchIds.length
    || report.conflicts !== conflictIds.length
  ) {
    throw new InvalidTaskExportError('Task restore collection counts are invalid');
  }
  return value as TaskRestoreCollectionReport;
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidTaskExportError(message);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new InvalidTaskExportError(message);
  }
  return value;
}

function requireStringArray(value: unknown): string[] {
  const array = requireArray(value, 'Task restore identifiers are invalid');
  if (array.some((item) => typeof item !== 'string')) {
    throw new InvalidTaskExportError('Task restore identifiers are invalid');
  }
  return array as string[];
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
