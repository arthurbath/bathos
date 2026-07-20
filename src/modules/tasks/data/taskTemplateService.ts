import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '@/modules/tasks/domain/taskDates';
import {
  taskActorTypes,
  taskEntryChannels,
  taskTemplateKinds,
  type TaskProjectTemplateSnapshot,
  type TaskTemplate,
  type TaskTemplateInstantiation,
  type TaskTemplateKind,
  type TaskTemplateRevision,
  type TaskTemplateSnapshot,
  type TaskTodoTemplateSnapshot,
} from '@/modules/tasks/types/tasks';

type TaskTemplateClient = Pick<SupabaseClient<Database>, 'rpc'>;

export type TaskTemplateCaptureInput = {
  templateId?: string | null;
  sourceType: TaskTemplateKind;
  sourceId: string;
  name: string;
  anchorDate: string;
  mutationId?: string;
};

export type TaskTemplateCaptureResult = {
  outcome: 'accepted' | 'already_applied';
  template: TaskTemplate;
  revision: TaskTemplateRevision;
};

export type TaskTemplateArchiveResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  template: TaskTemplate;
};

export type TaskTemplateInstanceResult = {
  root_type: TaskTemplateKind;
  root_id: string;
  project_id: string | null;
  heading_ids: string[];
  task_ids: string[];
  checklist_item_ids: string[];
};

export type TaskTemplateInstantiationResult = {
  outcome: 'accepted' | 'already_applied';
  instantiation: TaskTemplateInstantiation;
  result: TaskTemplateInstanceResult;
};

export class InvalidTaskTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskTemplateError';
  }
}

export class TaskTemplateService {
  constructor(private readonly client: TaskTemplateClient) {}

  async capture(input: TaskTemplateCaptureInput): Promise<TaskTemplateCaptureResult> {
    const name = input.name.trim();
    if (!name || name.length > 500 || !isTaskCalendarDate(input.anchorDate)) {
      throw new InvalidTaskTemplateError('A template name and valid anchor date are required');
    }
    const { data, error } = await this.client.rpc('tasks_capture_template', {
      _template_id: (input.templateId ?? null) as unknown as string,
      _source_type: input.sourceType,
      _source_id: input.sourceId,
      _name: name,
      _anchor_date: input.anchorDate,
      _mutation_id: input.mutationId ?? crypto.randomUUID(),
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Template capture returned an invalid result');
    return {
      outcome: requireEnum(result.outcome, ['accepted', 'already_applied'], 'capture outcome'),
      template: parseTaskTemplate(result.template),
      revision: parseTaskTemplateRevision(result.revision),
    };
  }

  async archive(
    templateId: string,
    expectedRecordRevision: number,
    mutationId = crypto.randomUUID(),
  ): Promise<TaskTemplateArchiveResult> {
    const { data, error } = await this.client.rpc('tasks_archive_template', {
      _template_id: templateId,
      _expected_record_revision: expectedRecordRevision,
      _mutation_id: mutationId,
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Template archive returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'conflict'],
        'archive outcome',
      ),
      template: parseTaskTemplate(result.template),
    };
  }

  async instantiate(input: {
    templateId: string;
    templateRevision?: number | null;
    anchorDate: string;
    targetAreaId?: string | null;
    requestId?: string;
    entryChannel?: 'web' | 'mcp' | 'raycast' | 'native';
  }): Promise<TaskTemplateInstantiationResult> {
    if (!isTaskCalendarDate(input.anchorDate)) {
      throw new InvalidTaskTemplateError('A valid template anchor date is required');
    }
    const { data, error } = await this.client.rpc('tasks_instantiate_template', {
      _template_id: input.templateId,
      _template_revision: (input.templateRevision ?? null) as unknown as number,
      _anchor_date: input.anchorDate,
      _request_id: input.requestId ?? crypto.randomUUID(),
      _entry_channel: input.entryChannel ?? 'web',
      _actor_type: input.entryChannel === 'mcp' ? 'automation' : 'user',
      _target_area_id: input.targetAreaId ?? undefined,
    });
    if (error) throw error;
    const response = requireRecord(data, 'Template instantiation returned an invalid result');
    return {
      outcome: requireEnum(
        response.outcome,
        ['accepted', 'already_applied'],
        'instantiation outcome',
      ),
      instantiation: parseTaskTemplateInstantiation(response.instantiation),
      result: parseTaskTemplateInstanceResult(response.result),
    };
  }
}

export function parseTaskTemplate(value: unknown): TaskTemplate {
  const record = requireRecord(value, 'Template definition is invalid');
  const kind = requireEnum(record.kind, taskTemplateKinds, 'template kind');
  requireText(record.id, 'template identifier');
  requireText(record.owner_id, 'template owner');
  requireText(record.name, 'template name');
  requirePositiveInteger(record.current_revision, 'current revision');
  requirePositiveInteger(record.record_revision, 'record revision');
  requireEnum(record.last_mutation_channel, taskEntryChannels, 'mutation channel');
  requireEnum(record.last_actor_type, taskActorTypes, 'actor type');
  return { ...record, kind } as TaskTemplate;
}

export function parseTaskTemplateRevision(value: unknown): TaskTemplateRevision {
  const record = requireRecord(value, 'Template revision is invalid');
  const sourceType = requireEnum(record.source_type, taskTemplateKinds, 'template source type');
  requireText(record.id, 'template revision identifier');
  requireText(record.owner_id, 'template revision owner');
  requireText(record.template_id, 'template identifier');
  requirePositiveInteger(record.revision, 'template revision');
  requirePositiveInteger(record.source_revision, 'source revision');
  if (!isTaskCalendarDate(requireText(record.anchor_date, 'template anchor date'))) {
    throw new InvalidTaskTemplateError('Template revision contains an invalid anchor date');
  }
  const snapshot = parseTaskTemplateSnapshot(record.snapshot);
  if (snapshot.kind !== sourceType) {
    throw new InvalidTaskTemplateError('Template revision kind does not match its snapshot');
  }
  return { ...record, source_type: sourceType, snapshot } as TaskTemplateRevision;
}

export function parseTaskTemplateInstantiation(value: unknown): TaskTemplateInstantiation {
  const record = requireRecord(value, 'Template instantiation is invalid');
  const rootType = requireEnum(record.root_type, taskTemplateKinds, 'template root type');
  const entryChannel = requireEnum(record.entry_channel, taskEntryChannels, 'entry channel');
  const actorType = requireEnum(record.actor_type, taskActorTypes, 'actor type');
  requireText(record.id, 'template instantiation identifier');
  requireText(record.owner_id, 'template instantiation owner');
  requireText(record.template_id, 'template identifier');
  requirePositiveInteger(record.template_revision, 'template revision');
  return {
    ...record,
    root_type: rootType,
    entry_channel: entryChannel,
    actor_type: actorType,
  } as TaskTemplateInstantiation;
}

export function parseTaskTemplateSnapshot(value: unknown): TaskTemplateSnapshot {
  const parsed = parseJson(value);
  const record = requireRecord(parsed, 'Template snapshot is invalid');
  if (record.version !== 1) {
    throw new InvalidTaskTemplateError('Template snapshot version is unsupported');
  }
  const kind = requireEnum(record.kind, taskTemplateKinds, 'template snapshot kind');
  if (kind === 'todo') {
    return {
      version: 1,
      kind,
      root: parseTodoNode(record.root, false),
    } satisfies TaskTodoTemplateSnapshot;
  }
  const headings = requireArray(record.headings, 'Project template headings are invalid').map(
    (heading) => {
      const row = requireRecord(heading, 'Project template heading is invalid');
      return {
        node_id: requireText(row.node_id, 'heading node identifier'),
        title: requireText(row.title, 'heading title'),
        order_key: requireText(row.order_key, 'heading order'),
      };
    },
  );
  const root = parseTodoNode(record.root, false);
  return {
    version: 1,
    kind,
    root: {
      node_id: root.node_id,
      title: root.title,
      notes: root.notes,
      destination: root.destination,
      today_section: root.today_section,
      order_key: root.order_key,
      planning_order_key: requireText(
        requireRecord(record.root, 'Project template root is invalid').planning_order_key,
        'project planning order',
      ),
      start_offset_days: root.start_offset_days,
      deadline_offset_days: root.deadline_offset_days,
    },
    headings,
    todos: requireArray(record.todos, 'Project template to-dos are invalid').map(
      (todo) => parseTodoNode(todo, true),
    ),
  } satisfies TaskProjectTemplateSnapshot;
}

function parseTodoNode(value: unknown, includeHeading: boolean) {
  const record = requireRecord(value, 'Template to-do node is invalid');
  return {
    node_id: requireText(record.node_id, 'template node identifier'),
    ...(includeHeading
      ? { heading_node_id: optionalText(record.heading_node_id, 'heading node identifier') }
      : {}),
    title: requireText(record.title, 'template title'),
    notes: requireText(record.notes, 'template notes', true),
    actionability: requireEnum(
      record.actionability ?? 'actionable',
      ['actionable', 'waiting'] as const,
      'template actionability',
    ),
    destination: requireEnum(
      record.destination,
      ['inbox', 'today', 'anytime', 'someday'] as const,
      'template destination',
    ),
    today_section: requireEnum(
      record.today_section,
      ['daytime', 'evening'] as const,
      'template Today section',
    ),
    order_key: requireText(record.order_key, 'template order'),
    ...(record.hierarchy_order_key === undefined
      ? {}
      : { hierarchy_order_key: requireText(record.hierarchy_order_key, 'hierarchy order') }),
    start_offset_days: optionalInteger(record.start_offset_days, 'start offset'),
    deadline_offset_days: optionalInteger(record.deadline_offset_days, 'deadline offset'),
    checklist: requireArray(record.checklist ?? [], 'Template checklist is invalid').map((item) => {
      const row = requireRecord(item, 'Template checklist item is invalid');
      return {
        node_id: requireText(row.node_id, 'checklist node identifier'),
        title: requireText(row.title, 'checklist title'),
        order_key: requireText(row.order_key, 'checklist order'),
      };
    }),
  };
}

function parseTaskTemplateInstanceResult(value: unknown): TaskTemplateInstanceResult {
  const record = requireRecord(value, 'Template instance result is invalid');
  return {
    root_type: requireEnum(record.root_type, taskTemplateKinds, 'root type'),
    root_id: requireText(record.root_id, 'root identifier'),
    project_id: optionalText(record.project_id, 'project identifier'),
    heading_ids: requireStringArray(record.heading_ids, 'heading identifiers'),
    task_ids: requireStringArray(record.task_ids, 'task identifiers'),
    checklist_item_ids: requireStringArray(
      record.checklist_item_ids,
      'checklist identifiers',
    ),
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidTaskTemplateError('Template data contains malformed JSON');
  }
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  const parsed = parseJson(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidTaskTemplateError(message);
  }
  return parsed as Record<string, unknown>;
}

function requireArray(value: unknown, message: string): unknown[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) throw new InvalidTaskTemplateError(message);
  return parsed;
}

function requireStringArray(value: unknown, field: string): string[] {
  const array = requireArray(value, `${field} are invalid`);
  if (array.some((item) => typeof item !== 'string')) {
    throw new InvalidTaskTemplateError(`${field} are invalid`);
  }
  return array as string[];
}

function requireText(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new InvalidTaskTemplateError(`Template ${field} is invalid`);
  }
  return value;
}

function optionalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requireText(value, field);
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new InvalidTaskTemplateError(`Template ${field} is invalid`);
  }
  return value as number;
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value)) {
    throw new InvalidTaskTemplateError(`Template ${field} is invalid`);
  }
  return value as number;
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new InvalidTaskTemplateError(`Template ${field} is invalid`);
  }
  return value as T[number];
}
