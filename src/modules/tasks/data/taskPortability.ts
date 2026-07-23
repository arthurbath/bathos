import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/integrations/supabase/types';
import type {
  TaskHistoryEvent,
  TaskHistorySnapshot,
} from '@/modules/tasks/domain/taskHistory';
import type {
  TaskArea,
  TaskChecklistItem,
  TaskHierarchyHistoryEvent,
  TaskHierarchyOperation,
  TaskMailSource,
  TaskMailSourceEvent,
  TaskProject,
  TaskRecurrenceDefinition,
  TaskRecurrenceEvaluation,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
  TaskRecurrenceStatusEvent,
  TaskReminder,
  TaskReminderOccurrence,
  TaskTemplate,
  TaskTemplateInstantiation,
  TaskTemplateRevision,
  TaskTodo,
  TaskUserSettings,
} from '@/modules/tasks/types/tasks';

type TemplateProvenanceFields =
  | 'template_definition_id'
  | 'template_revision'
  | 'template_instantiation_id'
  | 'template_node_id';
type RecurrenceProvenanceFields =
  | 'recurrence_definition_id'
  | 'recurrence_revision'
  | 'recurrence_occurrence_id'
  | 'recurrence_logical_key';
type PreRecurrenceTaskTodo = Omit<TaskTodo, RecurrenceProvenanceFields> &
  Partial<Pick<TaskTodo, RecurrenceProvenanceFields>>;
type PreRecurrenceTaskProject = Omit<TaskProject, RecurrenceProvenanceFields> &
  Partial<Pick<TaskProject, RecurrenceProvenanceFields>>;
type PreTemplateTaskTodo = Omit<TaskTodo, TemplateProvenanceFields> &
  Partial<Pick<TaskTodo, TemplateProvenanceFields>>;
type PreTemplateTaskProject = Omit<TaskProject, TemplateProvenanceFields> &
  Partial<Pick<TaskProject, TemplateProvenanceFields>>;
type LegacyTaskHeading = {
  id: string;
  owner_id: string;
  project_id: string;
  title: string;
  order_key: string;
  disposition: string;
  deleted_at: string | null;
  deletion_root_id: string | null;
  entry_channel: string;
  last_mutation_channel: string;
  last_actor_type: string;
  revision: number;
  client_mutation_id: string;
  created_at: string;
  updated_at: string;
  template_definition_id?: string | null;
  template_revision?: number | null;
  template_instantiation_id?: string | null;
  template_node_id?: string | null;
};
type PreTemplateChecklistItem = Omit<TaskChecklistItem, TemplateProvenanceFields> &
  Partial<Pick<TaskChecklistItem, TemplateProvenanceFields>>;
type HierarchyTaskFields = 'area_id' | 'project_id' | 'heading_id' | 'hierarchy_order_key';
type LegacyTaskTodo = Omit<
  PreTemplateTaskTodo,
  'today_section' | 'actionability' | HierarchyTaskFields
>;
type LegacyTaskHistorySnapshot = Omit<
  TaskHistorySnapshot,
  'today_section' | 'actionability' | HierarchyTaskFields
>;
type LegacyTaskHistoryEvent = Omit<TaskHistoryEvent, 'before_state' | 'after_state'> & {
  before_state: LegacyTaskHistorySnapshot | null;
  after_state: LegacyTaskHistorySnapshot;
};
type PreActionabilityTaskTodo = Omit<PreTemplateTaskTodo, 'actionability'> & {
  actionability?: TaskTodo['actionability'];
};
type PreActionabilityTaskHistorySnapshot = Omit<TaskHistorySnapshot, 'actionability'> & {
  actionability?: TaskHistorySnapshot['actionability'];
};
type PreActionabilityTaskHistoryEvent = Omit<
  TaskHistoryEvent,
  'before_state' | 'after_state'
> & {
  before_state: PreActionabilityTaskHistorySnapshot | null;
  after_state: PreActionabilityTaskHistorySnapshot;
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
    tasks_todos: Array<Omit<PreActionabilityTaskTodo, 'owner_id'>>;
    tasks_history_events: Array<Omit<PreActionabilityTaskHistoryEvent, 'owner_id'>>;
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
    tasks_projects: Array<Omit<PreTemplateTaskProject, 'owner_id'>>;
    tasks_headings: Array<Omit<LegacyTaskHeading, 'owner_id'>>;
    tasks_todos: Array<Omit<PreActionabilityTaskTodo, 'owner_id'>>;
    tasks_checklist_items: Array<Omit<PreTemplateChecklistItem, 'owner_id'>>;
    tasks_history_events: Array<Omit<PreActionabilityTaskHistoryEvent, 'owner_id'>>;
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

export const taskExportV6Collections = [
  ...taskExportV5Collections,
  'tasks_mail_source_events',
] as const;

type TaskExportV6Collection = (typeof taskExportV6Collections)[number];

export type TaskExportV6 = {
  format: 'garden.bath.tasks.export';
  schema_version: 6;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV6Collections];
    counts: Record<TaskExportV6Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV6Collection, string>;
  };
  data: TaskExportV5['data'] & {
    tasks_mail_source_events: Array<Omit<TaskMailSourceEvent, 'owner_id'>>;
  };
};

export type TaskExportV7 = {
  format: 'garden.bath.tasks.export';
  schema_version: 7;
  created_at: string;
  manifest: TaskExportV6['manifest'];
  data: Omit<TaskExportV6['data'], 'tasks_todos' | 'tasks_history_events'> & {
    tasks_todos: Array<Omit<PreTemplateTaskTodo, 'owner_id'>>;
    tasks_history_events: Array<Omit<TaskHistoryEvent, 'owner_id'>>;
  };
};

export const taskExportV8Collections = [
  ...taskExportV6Collections,
  'tasks_templates',
  'tasks_template_revisions',
  'tasks_template_instantiations',
] as const;

type TaskExportV8Collection = (typeof taskExportV8Collections)[number];

export type TaskExportV8 = {
  format: 'garden.bath.tasks.export';
  schema_version: 8;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV8Collections];
    counts: Record<TaskExportV8Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV8Collection, string>;
  };
  data: Omit<
    TaskExportV7['data'],
    'tasks_projects' | 'tasks_headings' | 'tasks_todos' | 'tasks_checklist_items'
  > & {
    tasks_projects: Array<Omit<PreRecurrenceTaskProject, 'owner_id'>>;
    tasks_headings: Array<Omit<LegacyTaskHeading, 'owner_id'>>;
    tasks_todos: Array<Omit<PreRecurrenceTaskTodo, 'owner_id'>>;
    tasks_checklist_items: Array<Omit<TaskChecklistItem, 'owner_id'>>;
    tasks_templates: Array<Omit<TaskTemplate, 'owner_id'>>;
    tasks_template_revisions: Array<Omit<TaskTemplateRevision, 'owner_id'>>;
    tasks_template_instantiations: Array<Omit<TaskTemplateInstantiation, 'owner_id'>>;
  };
};

export const taskExportV9Collections = [
  ...taskExportV8Collections,
  'tasks_recurrence_definitions',
  'tasks_recurrence_revisions',
  'tasks_recurrence_occurrences',
  'tasks_recurrence_evaluations',
  'tasks_recurrence_status_events',
] as const;

type TaskExportV9Collection = (typeof taskExportV9Collections)[number];

export type TaskExportV9 = {
  format: 'garden.bath.tasks.export';
  schema_version: 9;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV9Collections];
    counts: Record<TaskExportV9Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV9Collection, string>;
  };
  data: Omit<TaskExportV8['data'], 'tasks_projects' | 'tasks_todos'> & {
    tasks_projects: Array<Omit<TaskProject, 'owner_id'>>;
    tasks_todos: Array<Omit<TaskTodo, 'owner_id'>>;
    tasks_recurrence_definitions: Array<Omit<TaskRecurrenceDefinition, 'owner_id'>>;
    tasks_recurrence_revisions: Array<Omit<TaskRecurrenceRevision, 'owner_id'>>;
    tasks_recurrence_occurrences: Array<Omit<TaskRecurrenceOccurrence, 'owner_id'>>;
    tasks_recurrence_evaluations: Array<Omit<TaskRecurrenceEvaluation, 'owner_id'>>;
    tasks_recurrence_status_events: Array<Omit<TaskRecurrenceStatusEvent, 'owner_id'>>;
  };
};

export const taskExportV10Collections = [
  ...taskExportV9Collections,
  'tasks_reminders',
  'tasks_reminder_occurrences',
] as const;

export type TaskExportV10Collection = (typeof taskExportV10Collections)[number];

export type TaskExportV10 = {
  format: 'garden.bath.tasks.export';
  schema_version: 10;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV10Collections];
    counts: Record<TaskExportV10Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV10Collection, string>;
  };
  data: TaskExportV9['data'] & {
    tasks_reminders: Array<Omit<TaskReminder, 'owner_id'>>;
    tasks_reminder_occurrences: Array<Omit<TaskReminderOccurrence, 'owner_id'>>;
  };
};

export const taskExportV11Collections = [...taskExportV10Collections] as const;

export type TaskExportV11Collection = (typeof taskExportV11Collections)[number];

export type TaskExportV11 = {
  format: 'garden.bath.tasks.export';
  schema_version: 11;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV11Collections];
    counts: Record<TaskExportV11Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV11Collection, string>;
  };
  data: TaskExportV10['data'];
};

export const taskExportV12Collections = [
  'tasks_areas',
  'tasks_projects',
  'tasks_todos',
  'tasks_checklist_items',
  'tasks_history_events',
  'tasks_hierarchy_operations',
  'tasks_hierarchy_history_events',
  'tasks_user_settings',
  'tasks_mail_sources',
  'tasks_mail_source_events',
  'tasks_templates',
  'tasks_template_revisions',
  'tasks_template_instantiations',
  'tasks_recurrence_definitions',
  'tasks_recurrence_revisions',
  'tasks_recurrence_occurrences',
  'tasks_recurrence_evaluations',
  'tasks_recurrence_status_events',
  'tasks_reminders',
  'tasks_reminder_occurrences',
] as const;

export type TaskExportV12Collection = (typeof taskExportV12Collections)[number];

export type TaskExportV12 = {
  format: 'garden.bath.tasks.export';
  schema_version: 12;
  created_at: string;
  manifest: {
    collections: [...typeof taskExportV12Collections];
    counts: Record<TaskExportV12Collection, number>;
    checksums: { algorithm: 'sha256' } & Record<TaskExportV12Collection, string>;
  };
  data: Omit<TaskExportV11['data'], 'tasks_headings'>;
};

export type TaskPortableExport =
  | TaskExportV1
  | TaskExportV2
  | TaskExportV3
  | TaskExportV4
  | TaskExportV5
  | TaskExportV6
  | TaskExportV7
  | TaskExportV8
  | TaskExportV9
  | TaskExportV10
  | TaskExportV11
  | TaskExportV12;

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
  schema_version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  applied?: boolean;
  code?: string | null;
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
  tasks_mail_source_events?: TaskRestoreCollectionReport;
  tasks_templates?: TaskRestoreCollectionReport;
  tasks_template_revisions?: TaskRestoreCollectionReport;
  tasks_template_instantiations?: TaskRestoreCollectionReport;
  tasks_recurrence_definitions?: TaskRestoreCollectionReport;
  tasks_recurrence_revisions?: TaskRestoreCollectionReport;
  tasks_recurrence_occurrences?: TaskRestoreCollectionReport;
  tasks_recurrence_evaluations?: TaskRestoreCollectionReport;
  tasks_recurrence_status_events?: TaskRestoreCollectionReport;
  tasks_reminders?: TaskRestoreCollectionReport;
  tasks_reminder_occurrences?: TaskRestoreCollectionReport;
};

export const TASK_REPLACE_RESTORE_CONFIRMATION = 'REPLACE TASK DATA';

export type TaskReplaceRestorePreparation = {
  schema_version: 12;
  backup: TaskExportV12;
  backup_digest: string;
  current_counts: Record<TaskExportV12Collection, number>;
  incoming_counts: Record<TaskExportV12Collection, number>;
  restore_preview: TaskRestoreReport;
};

export type TaskReplaceRestoreResult = {
  outcome: 'accepted';
  schema_version: 12;
  request_id: string;
  backup_digest: string;
  target_digest: string;
  removed_counts: Record<TaskExportV12Collection, number>;
  restore_report: TaskRestoreReport;
};

type TaskPortabilityClient = Pick<SupabaseClient<Database>, 'rpc'>;

export class InvalidTaskExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskExportError';
  }
}

export class TaskPortabilityService {
  constructor(private readonly client: TaskPortabilityClient) {}

  createExport(): Promise<TaskExportV12> {
    return createTaskExport(this.client);
  }

  previewRestore(taskExport: TaskPortableExport): Promise<TaskRestoreReport> {
    return previewTaskRestore(this.client, taskExport);
  }

  mergeRestore(taskExport: TaskPortableExport): Promise<TaskRestoreReport> {
    return mergeTaskRestore(this.client, taskExport);
  }

  prepareReplace(taskExport: TaskExportV12): Promise<TaskReplaceRestorePreparation> {
    return prepareTaskReplaceRestore(this.client, taskExport);
  }

  replace(input: {
    taskExport: TaskExportV12;
    preparation: TaskReplaceRestorePreparation;
    confirmation: string;
    requestId?: string;
  }): Promise<TaskReplaceRestoreResult> {
    return replaceTaskRestore(this.client, input);
  }
}

export async function createTaskExport(
  supabase: TaskPortabilityClient,
): Promise<TaskExportV12> {
  const { data, error } = await supabase.rpc('tasks_create_export_v12');
  if (error) {
    throw error;
  }
  const taskExport = parseTaskExport(data);
  if (taskExport.schema_version !== 12) {
    throw new InvalidTaskExportError('The current task export did not use schema version twelve');
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

export async function prepareTaskReplaceRestore(
  supabase: TaskPortabilityClient,
  taskExport: TaskExportV12,
): Promise<TaskReplaceRestorePreparation> {
  const validatedExport = requireCurrentTaskExport(taskExport);
  const { data, error } = await supabase.rpc('tasks_prepare_replace_restore_v12', {
    _envelope: validatedExport as unknown as Json,
  });
  if (error) throw error;
  return parseReplacePreparation(data);
}

export async function replaceTaskRestore(
  supabase: TaskPortabilityClient,
  input: {
    taskExport: TaskExportV12;
    preparation: TaskReplaceRestorePreparation;
    confirmation: string;
    requestId?: string;
  },
): Promise<TaskReplaceRestoreResult> {
  const validatedExport = requireCurrentTaskExport(input.taskExport);
  if (input.confirmation !== TASK_REPLACE_RESTORE_CONFIRMATION) {
    throw new InvalidTaskExportError('Enter the replacement confirmation exactly');
  }
  if (!isSha256(input.preparation.backup_digest)) {
    throw new InvalidTaskExportError('A verified pre-restore backup is required');
  }
  const { data, error } = await supabase.rpc('tasks_replace_restore_v12', {
    _envelope: validatedExport as unknown as Json,
    _expected_backup_digest: input.preparation.backup_digest,
    _request_id: input.requestId ?? crypto.randomUUID(),
    _confirmation: input.confirmation,
  });
  if (error) throw error;
  return parseReplaceResult(data);
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
    || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(record.schema_version as number)
  ) {
    throw new InvalidTaskExportError('Task export format or schema version is unsupported');
  }
  const schemaVersion = record.schema_version as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

  const manifest = requireRecord(record.manifest, 'Task export manifest is invalid');
  const counts = requireRecord(manifest.counts, 'Task export counts are invalid');
  const checksums = requireRecord(manifest.checksums, 'Task export checksums are invalid');
  const data = requireRecord(record.data, 'Task export data is invalid');
  const collections = requireArray(manifest.collections, 'Task export collections are invalid');
  if (schemaVersion >= 4) {
    const expectedCollections = schemaVersion === 12
      ? taskExportV12Collections
      : schemaVersion === 11
      ? taskExportV11Collections
      : schemaVersion === 10
      ? taskExportV10Collections
      : schemaVersion === 9
      ? taskExportV9Collections
      : schemaVersion === 8
      ? taskExportV8Collections
      : schemaVersion >= 6
      ? taskExportV6Collections
      : schemaVersion === 5
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
    return schemaVersion === 12
      ? value as TaskExportV12
      : schemaVersion === 11
      ? value as TaskExportV11
      : schemaVersion === 10
      ? value as TaskExportV10
      : schemaVersion === 9
      ? value as TaskExportV9
      : schemaVersion === 8
      ? value as TaskExportV8
      : schemaVersion === 7
      ? value as TaskExportV7
      : schemaVersion === 6
      ? value as TaskExportV6
      : schemaVersion === 5
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
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
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
    const expectedCollections = schemaVersion === 12
      ? taskExportV12Collections
      : schemaVersion === 11
      ? taskExportV11Collections
      : schemaVersion === 10
      ? taskExportV10Collections
      : schemaVersion === 9
      ? taskExportV9Collections
      : schemaVersion === 8
      ? taskExportV8Collections
      : schemaVersion >= 6
      ? taskExportV6Collections
      : schemaVersion === 5
        ? taskExportV5Collections
        : taskExportV4Collections;
    for (const collection of expectedCollections) {
      parseCollectionReport(report[collection]);
    }
  }
  return value as TaskRestoreReport;
}

function requireCurrentTaskExport(value: unknown): TaskExportV12 {
  const taskExport = parseTaskExport(value);
  if (taskExport.schema_version !== 12) {
    throw new InvalidTaskExportError('Replace restore requires a current schema version twelve export');
  }
  return taskExport;
}

function parseReplacePreparation(value: unknown): TaskReplaceRestorePreparation {
  const preparation = requireRecord(value, 'Task replacement preparation is invalid');
  if (preparation.schema_version !== 12 || !isSha256(preparation.backup_digest)) {
    throw new InvalidTaskExportError('Task replacement preparation metadata is invalid');
  }
  const backup = requireCurrentTaskExport(preparation.backup);
  return {
    schema_version: 12,
    backup,
    backup_digest: preparation.backup_digest,
    current_counts: parseV12Counts(preparation.current_counts),
    incoming_counts: parseV12Counts(preparation.incoming_counts),
    restore_preview: parseTaskRestoreReport(preparation.restore_preview, 12),
  };
}

function parseReplaceResult(value: unknown): TaskReplaceRestoreResult {
  const result = requireRecord(value, 'Task replacement result is invalid');
  if (
    result.outcome !== 'accepted'
    || result.schema_version !== 12
    || typeof result.request_id !== 'string'
    || !result.request_id
    || !isSha256(result.backup_digest)
    || !isSha256(result.target_digest)
  ) {
    throw new InvalidTaskExportError('Task replacement result metadata is invalid');
  }
  return {
    outcome: 'accepted',
    schema_version: 12,
    request_id: result.request_id,
    backup_digest: result.backup_digest,
    target_digest: result.target_digest,
    removed_counts: parseV12Counts(result.removed_counts),
    restore_report: parseTaskRestoreReport(result.restore_report, 12),
  };
}

function parseV12Counts(value: unknown): Record<TaskExportV12Collection, number> {
  const counts = requireRecord(value, 'Task replacement collection counts are invalid');
  for (const collection of taskExportV12Collections) {
    if (!Number.isInteger(counts[collection]) || (counts[collection] as number) < 0) {
      throw new InvalidTaskExportError('Task replacement collection counts are invalid');
    }
  }
  return counts as Record<TaskExportV12Collection, number>;
}

async function restoreTaskExport(
  supabase: TaskPortabilityClient,
  taskExport: TaskPortableExport,
  dryRun: boolean,
): Promise<TaskRestoreReport> {
  const validatedExport = parseTaskExport(taskExport);
  const { data, error } = await supabase.rpc('tasks_restore_export_current', {
    _envelope: validatedExport as unknown as Json,
    _dry_run: dryRun,
  });
  if (error) {
    throw error;
  }
  return parseTaskRestoreReport(data, 12);
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
