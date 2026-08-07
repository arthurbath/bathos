import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { TaskDisposition, TaskLifecycle } from '@/modules/tasks/domain/taskState';

export const taskDestinations = ['anytime', 'someday'] as const;
export const taskTodaySections = ['inbox', 'now', 'next', 'later'] as const;
export const taskActionabilities = ['actionable', 'waiting', 'rechecking'] as const;
export const taskEntryChannels = [
  'web',
  'raycast',
  'mcp',
  'mail_automation',
  'browser_capture',
  'native',
  'widget',
  'watch',
  'import',
] as const;
export const taskSourceKinds = [
  'webpage',
  'mail_message',
  'file',
  'selected_text',
  'reading_item',
  'other',
] as const;
export const taskMailSourceLifecycles = [
  'retained',
  'retirement_pending',
  'retirement_failed',
  'retired',
] as const;
export const taskMailSourceTransitions = [
  'retirement_started',
  'retirement_failed',
  'retired',
] as const;
export const taskRecurrenceStatuses = ['active', 'paused', 'archived'] as const;
export const taskRecurrenceRuleModes = ['calendar', 'after_completion'] as const;
export const taskRecurrenceFrequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export const taskRecurrenceMissedPolicies = ['skip', 'latest', 'all'] as const;
export const taskRecurrenceEndModes = ['never', 'after', 'on_date'] as const;
export const taskRecurrenceOccurrenceOrigins = ['adopted', 'generated'] as const;
export const taskReminderStatuses = ['active', 'canceled'] as const;
export const taskReminderAmbiguityChoices = ['earlier', 'later'] as const;
export const taskReminderResolutionKinds = [
  'exact',
  'gap_forward',
  'ambiguous_earlier',
  'ambiguous_later',
] as const;
export const taskDeliveryChannels = ['in_app', 'web_push', 'native_push'] as const;
export const taskDeliveryCapabilityStatuses = ['active', 'degraded', 'revoked'] as const;
export const taskReminderDeliveryStatuses = [
  'scheduled',
  'attempted',
  'provider_accepted',
  'failed',
  'acknowledged',
  'canceled',
] as const;
export const taskActorTypes = ['user', 'automation', 'system', 'import'] as const;
export const taskHierarchyRootTypes = [
  'area',
  'todo',
  'checklist_item',
] as const;
export const taskHierarchyOperations = [
  'delete',
  'restore',
] as const;
export const taskHierarchyDescendantPolicies = ['reject', 'cascade'] as const;
export const taskHierarchyOperationOutcomes = [
  'pending',
  'accepted',
  'noop',
  'rejected',
  'conflict',
] as const;
export const taskMutationTransitions = [
  'baseline',
  'create',
  'update',
  'move',
  'reorder',
  'set_actionability',
  'complete',
  'cancel',
  'reopen',
  'delete',
  'restore',
  'undo',
  'redo',
] as const;

export type TaskDestination = (typeof taskDestinations)[number];
export type TaskTodaySection = (typeof taskTodaySections)[number];
export type TaskActionability = (typeof taskActionabilities)[number];
export type TaskEntryChannel = (typeof taskEntryChannels)[number];
export type TaskSourceKind = (typeof taskSourceKinds)[number];
export type TaskMailSourceLifecycle = (typeof taskMailSourceLifecycles)[number];
export type TaskMailSourceTransition = (typeof taskMailSourceTransitions)[number];
export type TaskRecurrenceStatus = (typeof taskRecurrenceStatuses)[number];
export type TaskRecurrenceRuleMode = (typeof taskRecurrenceRuleModes)[number];
export type TaskRecurrenceFrequency = (typeof taskRecurrenceFrequencies)[number];
export type TaskRecurrenceMissedPolicy = (typeof taskRecurrenceMissedPolicies)[number];
export type TaskRecurrenceEndMode = (typeof taskRecurrenceEndModes)[number];
export type TaskRecurrenceOccurrenceOrigin =
  (typeof taskRecurrenceOccurrenceOrigins)[number];
export type TaskReminderStatus = (typeof taskReminderStatuses)[number];
export type TaskReminderAmbiguityChoice = (typeof taskReminderAmbiguityChoices)[number];
export type TaskReminderResolutionKind = (typeof taskReminderResolutionKinds)[number];
export type TaskDeliveryChannel = (typeof taskDeliveryChannels)[number];
export type TaskDeliveryCapabilityStatus = (typeof taskDeliveryCapabilityStatuses)[number];
export type TaskReminderDeliveryStatus = (typeof taskReminderDeliveryStatuses)[number];
export type TaskActorType = (typeof taskActorTypes)[number];
export type TaskHierarchyRootType = (typeof taskHierarchyRootTypes)[number];
export type TaskHierarchyOperationKind = (typeof taskHierarchyOperations)[number];
export type TaskHierarchyDescendantPolicy =
  (typeof taskHierarchyDescendantPolicies)[number];
export type TaskHierarchyOperationOutcome =
  (typeof taskHierarchyOperationOutcomes)[number];
export type TaskMutationTransition = (typeof taskMutationTransitions)[number];

type TaskTodoRow = Tables<'tasks_todos'>;
type TaskTodoInsertRow = TablesInsert<'tasks_todos'>;
type TaskTodoUpdateRow = TablesUpdate<'tasks_todos'>;
type TaskAreaRow = Tables<'tasks_areas'>;
type TaskChecklistItemRow = Tables<'tasks_checklist_items'>;
type TaskMailSourceRow = Tables<'tasks_mail_sources'>;
type TaskMailSourceEventRow = Tables<'tasks_mail_source_events'>;
type TaskHierarchyOperationRow = Tables<'tasks_hierarchy_operations'>;
type TaskHierarchyHistoryRow = Tables<'tasks_hierarchy_history_events'>;
type TaskRecurrenceDefinitionRow = Tables<'tasks_recurrence_definitions'>;
type TaskRecurrenceRevisionRow = Tables<'tasks_recurrence_revisions'>;
type TaskRecurrenceOccurrenceRow = Tables<'tasks_recurrence_occurrences'>;
type TaskRecurrenceEvaluationRow = Tables<'tasks_recurrence_evaluations'>;
type TaskRecurrenceStatusEventRow = Tables<'tasks_recurrence_status_events'>;
type TaskReminderRow = Tables<'tasks_reminders'>;
type TaskReminderOccurrenceRow = Tables<'tasks_reminder_occurrences'>;
type TaskDeliveryTargetRow = Tables<'tasks_delivery_targets'>;
type TaskReminderDeliveryRow = Tables<'tasks_reminder_deliveries'>;

type RefinedTaskFields = {
  lifecycle: TaskLifecycle;
  disposition: TaskDisposition;
  destination: TaskDestination;
  today_section: TaskTodaySection | null;
  actionability: TaskActionability;
  entry_channel: TaskEntryChannel;
  last_mutation_channel: TaskEntryChannel;
  last_actor_type: TaskActorType;
  source_kind: TaskSourceKind | null;
};

export type TaskTodo = Omit<TaskTodoRow, keyof RefinedTaskFields> & RefinedTaskFields;

export type TaskTodoInsert = Omit<TaskTodoInsertRow, keyof RefinedTaskFields> &
  Partial<RefinedTaskFields>;

export type TaskTodoUpdate = Omit<TaskTodoUpdateRow, keyof RefinedTaskFields> &
  Partial<RefinedTaskFields>;

type RefinedHierarchyFields = {
  disposition: TaskDisposition;
  entry_channel: TaskEntryChannel;
  last_mutation_channel: TaskEntryChannel;
  last_actor_type: TaskActorType;
};

export type TaskArea = Omit<TaskAreaRow, keyof RefinedHierarchyFields> &
  RefinedHierarchyFields;

export type TaskChecklistItem = Omit<
  TaskChecklistItemRow,
  keyof RefinedHierarchyFields
> & RefinedHierarchyFields;

export type TaskMailSource = Omit<TaskMailSourceRow, 'lifecycle'> & {
  lifecycle: TaskMailSourceLifecycle;
};

export type TaskMailSourceEvent = Omit<
  TaskMailSourceEventRow,
  'transition' | 'base_lifecycle' | 'result_lifecycle'
> & {
  transition: TaskMailSourceTransition;
  base_lifecycle: Exclude<TaskMailSourceLifecycle, 'retired'>;
  result_lifecycle: Exclude<TaskMailSourceLifecycle, 'retained'>;
};

type RefinedHierarchyOperationFields = {
  root_type: TaskHierarchyRootType;
  operation: TaskHierarchyOperationKind;
  descendant_policy: TaskHierarchyDescendantPolicy;
  actor_type: TaskActorType;
  mutation_channel: TaskEntryChannel;
  outcome: TaskHierarchyOperationOutcome;
};

export type TaskHierarchyOperation = Omit<
  TaskHierarchyOperationRow,
  keyof RefinedHierarchyOperationFields
> & RefinedHierarchyOperationFields;

export type TaskHierarchyHistoryEvent = Omit<
  TaskHierarchyHistoryRow,
  'entity_type' | 'actor_type' | 'mutation_channel' | 'transition'
> & {
  entity_type: Exclude<TaskHierarchyRootType, 'todo'>;
  actor_type: TaskActorType;
  mutation_channel: TaskEntryChannel;
  transition: Exclude<TaskMutationTransition, 'undo' | 'redo'>;
};

export type TaskRecurrencePrototypeChecklistItem = {
  node_id: string;
  title: string;
  completed: boolean;
  order_key: string;
};

export type TaskRecurrencePrototypeTodo = {
  node_id: string;
  title: string;
  notes: string;
  primary_link: string | null;
  actionability: TaskActionability;
  destination: TaskDestination;
  today_section: TaskTodaySection | null;
  order_key: string;
  hierarchy_order_key?: string;
  start_offset_days: number | null;
  deadline_offset_days: number | null;
  checklist: TaskRecurrencePrototypeChecklistItem[];
};

export type TaskRecurrencePrototypeSnapshot = {
  version: 2;
  kind: 'todo';
  root: TaskRecurrencePrototypeTodo;
};

export type TaskRecurrenceDefinition = Omit<
  TaskRecurrenceDefinitionRow,
  'status' | 'last_mutation_channel' | 'last_actor_type'
> & {
  status: TaskRecurrenceStatus;
  last_mutation_channel: TaskEntryChannel;
  last_actor_type: TaskActorType;
};

export type TaskRecurrenceRevision = Omit<
  TaskRecurrenceRevisionRow,
  | 'rule_mode'
  | 'frequency'
  | 'missed_policy'
  | 'end_mode'
  | 'prototype_snapshot'
  | 'date_basis'
> & {
  rule_mode: TaskRecurrenceRuleMode;
  frequency: TaskRecurrenceFrequency;
  missed_policy: TaskRecurrenceMissedPolicy;
  end_mode: TaskRecurrenceEndMode;
  date_basis: TaskRecurrenceDateBasis;
  rule_config: TaskRecurrenceRuleConfig;
  prototype_snapshot: TaskRecurrencePrototypeSnapshot;
};

export const taskRecurrenceDateBases = ['start', 'deadline'] as const;
export type TaskRecurrenceDateBasis = (typeof taskRecurrenceDateBases)[number];

export const taskRecurrenceDayTypes = [
  'day',
  'weekday',
  'weekend_day',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type TaskRecurrenceDayType = (typeof taskRecurrenceDayTypes)[number];
export type TaskRecurrencePosition = number | 'last';

export type TaskRecurrenceOccurrence = Omit<
  TaskRecurrenceOccurrenceRow,
  'root_type' | 'origin'
> & {
  root_type: 'todo';
  origin: TaskRecurrenceOccurrenceOrigin;
};

export type TaskRecurrenceRuleConfig = {
  version?: 2;
  weekdays?: number[];
  monthly_kind?:
    | 'day_of_month'
    | 'last_day'
    | 'ordinal_weekday'
    | 'ordinal_day_type';
  yearly_kind?: 'fixed_date' | 'last_day' | 'ordinal_weekday';
  month?: number;
  month_day?: number;
  ordinal?: -1 | 1 | 2 | 3 | 4 | 5;
  weekday?: number;
  day_type?: TaskRecurrenceDayType;
  position?: TaskRecurrencePosition;
  months?: number[];
};

export type TaskRecurrenceEvaluation = TaskRecurrenceEvaluationRow;
export type TaskRecurrenceStatusEvent = TaskRecurrenceStatusEventRow;

export type TaskReminder = Omit<
  TaskReminderRow,
  | 'root_type'
  | 'status'
  | 'ambiguity_choice'
  | 'resolution_kind'
  | 'last_mutation_channel'
  | 'last_actor_type'
> & {
  root_type: 'todo';
  status: TaskReminderStatus;
  ambiguity_choice: TaskReminderAmbiguityChoice;
  resolution_kind: TaskReminderResolutionKind;
  last_mutation_channel: TaskEntryChannel;
  last_actor_type: TaskActorType;
};

export type TaskReminderOccurrence = Omit<TaskReminderOccurrenceRow, 'status'> & {
  status: 'scheduled' | 'canceled';
};

export type TaskDeliveryTarget = Omit<
  TaskDeliveryTargetRow,
  'channel' | 'capability_status'
> & {
  channel: TaskDeliveryChannel;
  capability_status: TaskDeliveryCapabilityStatus;
};

export type TaskReminderDelivery = Omit<TaskReminderDeliveryRow, 'status'> & {
  status: TaskReminderDeliveryStatus;
};

export type TaskUserSettings = Tables<'tasks_user_settings'>;
