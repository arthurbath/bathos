import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/integrations/supabase/types';
import type {
  TaskHistoryEvent,
  TaskHistorySnapshot,
} from '@/modules/tasks/domain/taskHistory';
import type {
  TaskArea,
  TaskChecklistItem,
  TaskHeading,
  TaskHierarchyHistoryEvent,
  TaskHierarchyOperation,
  TaskMailSource,
  TaskProject,
  TaskTodo,
  TaskUserSettings,
} from '@/modules/tasks/types/tasks';

type HierarchyTaskFields = 'area_id' | 'project_id' | 'heading_id' | 'hierarchy_order_key';
type LegacyTaskTodo = Omit<TaskTodo, 'today_section' | HierarchyTaskFields>;
type LegacyTaskHistorySnapshot = Omit<
  TaskHistorySnapshot,
  'today_section' | HierarchyTaskFields
>;
type LegacyTaskHistoryEvent = Omit<TaskHistoryEvent, 'before_state' | 'after_state'> & {
  before_state: LegacyTaskHistorySnapshot | null;
  after_state: LegacyTaskHistorySnapshot;
};

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
    tasks_todos: Array<Omit<LegacyTaskTodo, 'owner_id'>>;
    tasks_history_events: Array<Omit<LegacyTaskHistoryEvent, 'owner_id'>>;
  };
};

export type TaskExportV2 = {
  format: 'garden.bath.tasks.export';
  schema_version: 2;
  created_at: string;
  manifest: {
    collections: ['tasks_todos', 'tasks_history_events', 'tasks_user_settings'];
    counts: {
      tasks_todos: number;
      tasks_history_events: number;
      tasks_user_settings: number;
    };
    checksums: {
      algorithm: 'sha256';
      tasks_todos: string;
      tasks_history_events: string;
      tasks_user_settings: string;
    };
  };
  data: {
    tasks_todos: Array<Omit<LegacyTaskTodo, 'owner_id'>>;
    tasks_history_events: Array<Omit<LegacyTaskHistoryEvent, 'owner_id'>>;
    tasks_user_settings: Array<Omit<TaskUserSettings, 'owner_id'>>;
  };
};

export type TaskExportV3 = {
  format: 'garden.bath.tasks.export';
  schema_version: 3;
  created_at: string;
  manifest: TaskExportV2['manifest'];
  data: {
    tasks_todos: Array<Omit<TaskTodo, 'owner_id'>>;
    tasks_history_events: Array<Omit<TaskHistoryEvent, 'owner_id'>>;
    tasks_user_settings: Array<Omit<TaskUserSettings, 'owner_id'>>;
  };
};

export const taskExportV4Collections = [
  'tasks_areas',
  'tasks_projects',
  'tasks_headings',
  'tasks_todos',
  'tasks_checklist_items',
  'tasks_history_events',
  'tasks_hierarchy_operations',
  'tasks_hierarchy_history_events',
  'tasks_user_settings',
] as const;

type TaskExportV4Collection = (typeof taskExportV4Collections)[number];

export type TaskExportV4 = {
  format: 'garden.bath.tasks.export';
  schema_version: 4;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV4Collections];
    counts: Record<TaskExportV4Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV4Collection, string>;
  };
  data: {
    tasks_areas: Array<Omit<TaskArea, 'owner_id'>>;
    tasks_projects: Array<Omit<TaskProject, 'owner_id'>>;
    tasks_headings: Array<Omit<TaskHeading, 'owner_id'>>;
    tasks_todos: Array<Omit<TaskTodo, 'owner_id'>>;
    tasks_checklist_items: Array<Omit<TaskChecklistItem, 'owner_id'>>;
    tasks_history_events: Array<Omit<TaskHistoryEvent, 'owner_id'>>;
    tasks_hierarchy_operations: Array<Omit<TaskHierarchyOperation, 'owner_id'>>;
    tasks_hierarchy_history_events: Array<Omit<TaskHierarchyHistoryEvent, 'owner_id'>>;
    tasks_user_settings: Array<Omit<TaskUserSettings, 'owner_id'>>;
  };
};

export const taskExportV5Collections = [
  ...taskExportV4Collections,
  'tasks_mail_sources',
] as const;

type TaskExportV5Collection = (typeof taskExportV5Collections)[number];

export type TaskExportV5 = {
  format: 'garden.bath.tasks.export';
  schema_version: 5;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV5Collections];
    counts: Record<TaskExportV5Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV5Collection, string>;
  };
  data: TaskExportV4['data'] & {
    tasks_mail_sources: Array<Omit<TaskMailSource, 'owner_id'>>;
  };
};

export type TaskPortableExport =
  | TaskExportV1
  | TaskExportV2
  | TaskExportV3
  | TaskExportV4
  | TaskExportV5;

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
  schema_version: 1 | 2 | 3 | 4 | 5;
  tasks_todos: TaskRestoreCollectionReport;
  tasks_history_events: TaskRestoreCollectionReport;
  tasks_user_settings?: TaskRestoreCollectionReport;
  tasks_areas?: TaskRestoreCollectionReport;
  tasks_projects?: TaskRestoreCollectionReport;
  tasks_headings?: TaskRestoreCollectionReport;
  tasks_checklist_items?: TaskRestoreCollectionReport;
  tasks_hierarchy_operations?: TaskRestoreCollectionReport;
  tasks_hierarchy_history_events?: TaskRestoreCollectionReport;
  tasks_mail_sources?: TaskRestoreCollectionReport;
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
): Promise<TaskExportV5> {
  const { data, error } = await supabase.rpc('tasks_create_export_v5');
  if (error) {
    throw error;
  }
  const taskExport = parseTaskExport(data);
  if (taskExport.schema_version !== 5) {
    throw new InvalidTaskExportError('The current task export did not use schema version five');
  }
  return taskExport;
}

export async function previewTaskRestore(
  supabase: TaskPortabilityClient,
  taskExport: TaskPortableExport,
): Promise<TaskRestoreReport> {
  return restoreTaskExport(supabase, taskExport, true);
}

export async function mergeTaskRestore(
  supabase: TaskPortabilityClient,
  taskExport: TaskPortableExport,
): Promise<TaskRestoreReport> {
  return restoreTaskExport(supabase, taskExport, false);
}

export function serializeTaskExport(taskExport: TaskPortableExport): string {
  return `${JSON.stringify(taskExport, null, 2)}\n`;
}

export function getTaskExportFilename(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.valueOf())) {
    throw new InvalidTaskExportError('Task export contains an invalid creation time');
  }
  return `bathos-tasks-${date.toISOString().slice(0, 10)}.json`;
}

export function parseTaskExport(value: unknown): TaskPortableExport {
  const record = requireRecord(value, 'Task export must be a JSON object');
  if (
    record.format !== 'garden.bath.tasks.export'
    || ![1, 2, 3, 4, 5].includes(record.schema_version as number)
  ) {
    throw new InvalidTaskExportError('Task export format or schema version is unsupported');
  }
  const schemaVersion = record.schema_version as 1 | 2 | 3 | 4 | 5;

  const manifest = requireRecord(record.manifest, 'Task export manifest is invalid');
  const counts = requireRecord(manifest.counts, 'Task export counts are invalid');
  const checksums = requireRecord(manifest.checksums, 'Task export checksums are invalid');
  const data = requireRecord(record.data, 'Task export data is invalid');
  const collections = requireArray(manifest.collections, 'Task export collections are invalid');
  if (schemaVersion >= 4) {
    const expectedCollections = schemaVersion === 5
      ? taskExportV5Collections
      : taskExportV4Collections;
    if (
      typeof record.created_at !== 'string'
      || collections.length !== expectedCollections.length
      || expectedCollections.some((collection, index) => collections[index] !== collection)
      || checksums.algorithm !== 'sha256'
    ) {
      throw new InvalidTaskExportError('Task export manifest does not match its data');
    }
    for (const collection of expectedCollections) {
      const records = requireArray(data[collection], `Task export ${collection} data is invalid`);
      if (counts[collection] !== records.length || !isSha256(checksums[collection])) {
        throw new InvalidTaskExportError('Task export manifest does not match its data');
      }
    }
    return schemaVersion === 5
      ? value as TaskExportV5
      : value as TaskExportV4;
  }

  const tasks = requireArray(data.tasks_todos, 'Task export tasks are invalid');
  const history = requireArray(data.tasks_history_events, 'Task export history is invalid');
  const settings = schemaVersion >= 2
    ? requireArray(data.tasks_user_settings, 'Task export settings are invalid')
    : null;

  if (
    typeof record.created_at !== 'string'
    || collections.length !== (schemaVersion >= 2 ? 3 : 2)
    || collections[0] !== 'tasks_todos'
    || collections[1] !== 'tasks_history_events'
    || (schemaVersion >= 2 && collections[2] !== 'tasks_user_settings')
    || counts.tasks_todos !== tasks.length
    || counts.tasks_history_events !== history.length
    || checksums.algorithm !== 'sha256'
    || !isSha256(checksums.tasks_todos)
    || !isSha256(checksums.tasks_history_events)
    || (
      schemaVersion >= 2
      && (
        counts.tasks_user_settings !== settings?.length
        || !isSha256(checksums.tasks_user_settings)
      )
    )
  ) {
    throw new InvalidTaskExportError('Task export manifest does not match its data');
  }

  return value as TaskPortableExport;
}

function parseTaskRestoreReport(
  value: unknown,
  schemaVersion: 1 | 2 | 3 | 4 | 5,
): TaskRestoreReport {
  const report = requireRecord(value, 'Task restore report is invalid');
  if (typeof report.dry_run !== 'boolean' || report.schema_version !== schemaVersion) {
    throw new InvalidTaskExportError('Task restore report metadata is invalid');
  }
  parseCollectionReport(report.tasks_todos);
  parseCollectionReport(report.tasks_history_events);
  if (schemaVersion >= 2) {
    parseCollectionReport(report.tasks_user_settings);
  }
  if (schemaVersion >= 4) {
    const expectedCollections = schemaVersion === 5
      ? taskExportV5Collections
      : taskExportV4Collections;
    for (const collection of expectedCollections) {
      parseCollectionReport(report[collection]);
    }
  }
  return value as TaskRestoreReport;
}

async function restoreTaskExport(
  supabase: TaskPortabilityClient,
  taskExport: TaskPortableExport,
  dryRun: boolean,
): Promise<TaskRestoreReport> {
  const validatedExport = parseTaskExport(taskExport);
  const functionName = validatedExport.schema_version === 5
    ? 'tasks_restore_export_v5'
    : validatedExport.schema_version === 4
      ? 'tasks_restore_export_v4'
      : validatedExport.schema_version === 3
        ? 'tasks_restore_export_v3'
        : validatedExport.schema_version === 2
          ? 'tasks_restore_export_v2'
          : 'tasks_restore_export_v1';
  const { data, error } = await supabase.rpc(functionName, {
    _envelope: validatedExport as unknown as Json,
    _dry_run: dryRun,
  });
  if (error) {
    throw error;
  }
  return parseTaskRestoreReport(data, validatedExport.schema_version);
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
