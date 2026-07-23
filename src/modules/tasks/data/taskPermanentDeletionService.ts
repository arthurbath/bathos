import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';

type TaskPermanentDeletionClient = Pick<SupabaseClient<Database>, 'rpc'>;

export const TASK_PERMANENT_DELETION_CONFIRMATION = 'PERMANENTLY DELETE';

export type TaskPermanentDeletionRootType = 'todo' | 'project';

export type TaskPermanentDeletionHierarchy = {
  projects: string[];
  todos: string[];
  checklist_items: string[];
};

export type TaskPermanentDeletionRelated = {
  task_history_events: string[];
  hierarchy_history_events: string[];
  mail_sources: string[];
  mail_source_events: string[];
  reminders: string[];
  reminder_occurrences: string[];
  reminder_deliveries: string[];
};

export type TaskPermanentDeletionPreservedReceipts = {
  hierarchy_operations: string[];
  template_instantiations: string[];
  recurrence_occurrences: string[];
};

export type TaskPermanentDeletionPreview = {
  root: {
    type: TaskPermanentDeletionRootType;
    id: string;
    title: string;
  };
  hierarchy: TaskPermanentDeletionHierarchy;
  related: TaskPermanentDeletionRelated;
  preserved_receipts: TaskPermanentDeletionPreservedReceipts;
  erased_record_count: number;
  scope_digest: string;
};

export type TaskPermanentDeletionResult = Omit<TaskPermanentDeletionPreview, 'root'> & {
  root: {
    type: TaskPermanentDeletionRootType;
    id: string;
  };
  outcome: 'accepted';
  request_id: string;
  completed_at: string;
};

export class InvalidTaskPermanentDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskPermanentDeletionError';
  }
}

export class TaskPermanentDeletionService {
  constructor(private readonly client: TaskPermanentDeletionClient) {}

  async preview(
    rootType: TaskPermanentDeletionRootType,
    rootId: string,
  ): Promise<TaskPermanentDeletionPreview> {
    if (!isRootType(rootType) || !rootId.trim()) {
      throw new InvalidTaskPermanentDeletionError('A deleted task or project is required');
    }
    const { data, error } = await this.client.rpc('tasks_preview_permanent_deletion', {
      _root_type: rootType,
      _root_id: rootId,
    });
    if (error) throw error;
    return parsePreview(data);
  }

  async execute(
    preview: TaskPermanentDeletionPreview,
    confirmation: string,
    requestId = crypto.randomUUID(),
  ): Promise<TaskPermanentDeletionResult> {
    if (confirmation !== TASK_PERMANENT_DELETION_CONFIRMATION) {
      throw new InvalidTaskPermanentDeletionError('Enter the permanent-deletion confirmation exactly');
    }
    if (!requestId.trim() || !isDigest(preview.scope_digest)) {
      throw new InvalidTaskPermanentDeletionError('A valid permanent-deletion preview is required');
    }
    const { data, error } = await this.client.rpc('tasks_permanently_delete', {
      _root_type: preview.root.type,
      _root_id: preview.root.id,
      _scope_digest: preview.scope_digest,
      _request_id: requestId,
      _confirmation: confirmation,
    });
    if (error) throw error;
    return parseResult(data);
  }
}

function parsePreview(value: unknown): TaskPermanentDeletionPreview {
  const result = requireRecord(value, 'Permanent-deletion preview returned an invalid result');
  const root = parseRoot(result.root, true);
  return {
    root: { ...root, title: requireString(root.title, 'permanent-deletion root title') },
    hierarchy: parseHierarchy(result.hierarchy),
    related: parseRelated(result.related),
    preserved_receipts: parsePreservedReceipts(result.preserved_receipts),
    erased_record_count: requireCount(result.erased_record_count, 'permanent-deletion record count'),
    scope_digest: requireDigest(result.scope_digest),
  };
}

function parseResult(value: unknown): TaskPermanentDeletionResult {
  const result = requireRecord(value, 'Permanent deletion returned an invalid result');
  const root = parseRoot(result.root, false);
  if (result.outcome !== 'accepted') {
    throw new InvalidTaskPermanentDeletionError('Permanent deletion returned an invalid outcome');
  }
  return {
    root: { type: root.type, id: root.id },
    hierarchy: parseHierarchy(result.hierarchy),
    related: parseRelated(result.related),
    preserved_receipts: parsePreservedReceipts(result.preserved_receipts),
    erased_record_count: requireCount(result.erased_record_count, 'permanent-deletion record count'),
    scope_digest: requireDigest(result.scope_digest),
    outcome: 'accepted',
    request_id: requireString(result.request_id, 'permanent-deletion request identifier'),
    completed_at: requireTimestamp(result.completed_at, 'permanent-deletion completion time'),
  };
}

function parseRoot(value: unknown, requireTitle: boolean) {
  const root = requireRecord(value, 'Permanent-deletion root is invalid');
  if (!isRootType(root.type)) {
    throw new InvalidTaskPermanentDeletionError('Permanent-deletion root type is invalid');
  }
  return {
    type: root.type,
    id: requireString(root.id, 'permanent-deletion root identifier'),
    title: requireTitle ? requireString(root.title, 'permanent-deletion root title') : undefined,
  };
}

function parseHierarchy(value: unknown): TaskPermanentDeletionHierarchy {
  const hierarchy = requireRecord(value, 'Permanent-deletion hierarchy is invalid');
  return {
    projects: requireStringArray(hierarchy.projects, 'projects'),
    todos: requireStringArray(hierarchy.todos, 'tasks'),
    checklist_items: requireStringArray(hierarchy.checklist_items, 'checklist items'),
  };
}

function parseRelated(value: unknown): TaskPermanentDeletionRelated {
  const related = requireRecord(value, 'Permanent-deletion related data is invalid');
  return {
    task_history_events: requireStringArray(related.task_history_events, 'task history events'),
    hierarchy_history_events: requireStringArray(
      related.hierarchy_history_events,
      'hierarchy history events',
    ),
    mail_sources: requireStringArray(related.mail_sources, 'Mail sources'),
    mail_source_events: requireStringArray(related.mail_source_events, 'Mail source events'),
    reminders: requireStringArray(related.reminders, 'reminders'),
    reminder_occurrences: requireStringArray(related.reminder_occurrences, 'reminder occurrences'),
    reminder_deliveries: requireStringArray(related.reminder_deliveries, 'reminder deliveries'),
  };
}

function parsePreservedReceipts(value: unknown): TaskPermanentDeletionPreservedReceipts {
  const receipts = requireRecord(value, 'Permanent-deletion receipt data is invalid');
  return {
    hierarchy_operations: requireStringArray(receipts.hierarchy_operations, 'hierarchy operations'),
    template_instantiations: requireStringArray(
      receipts.template_instantiations,
      'template instantiations',
    ),
    recurrence_occurrences: requireStringArray(
      receipts.recurrence_occurrences,
      'recurrence occurrences',
    ),
  };
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidTaskPermanentDeletionError(message);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidTaskPermanentDeletionError(`${label} is invalid`);
  }
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) {
    throw new InvalidTaskPermanentDeletionError(`Permanent-deletion ${label} are invalid`);
  }
  return value;
}

function requireCount(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new InvalidTaskPermanentDeletionError(`${label} is invalid`);
  }
  return value as number;
}

function requireDigest(value: unknown): string {
  if (typeof value !== 'string' || !isDigest(value)) {
    throw new InvalidTaskPermanentDeletionError('Permanent-deletion preview digest is invalid');
  }
  return value;
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).valueOf())) {
    throw new InvalidTaskPermanentDeletionError(`${label} is invalid`);
  }
  return value;
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isRootType(value: unknown): value is TaskPermanentDeletionRootType {
  return value === 'todo' || value === 'project';
}
