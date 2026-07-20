import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { TaskDisposition, TaskLifecycle } from '@/modules/tasks/domain/taskState';

export const taskDestinations = ['inbox', 'today', 'anytime', 'someday'] as const;
export const taskTodaySections = ['daytime', 'evening'] as const;
export const taskEntryChannels = [
  'web',
  'raycast',
  'mcp',
  'mail_automation',
  'browser_capture',
  'native',
  'import',
] as const;
export const taskSourceKinds = [
  'webpage',
  'mail_message',
  'file',
  'selected_text',
  'reading_item',
  'template',
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
export const taskActorTypes = ['user', 'automation', 'system', 'import'] as const;
export const taskHierarchyRootTypes = [
  'area',
  'project',
  'heading',
  'todo',
  'checklist_item',
] as const;
export const taskHierarchyOperations = [
  'complete_project',
  'cancel_project',
  'reopen_project',
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
  'complete',
  'cancel',
  'reopen',
  'delete',
  'restore',
  'undo',
] as const;

export type TaskDestination = (typeof taskDestinations)[number];
export type TaskTodaySection = (typeof taskTodaySections)[number];
export type TaskEntryChannel = (typeof taskEntryChannels)[number];
export type TaskSourceKind = (typeof taskSourceKinds)[number];
export type TaskMailSourceLifecycle = (typeof taskMailSourceLifecycles)[number];
export type TaskMailSourceTransition = (typeof taskMailSourceTransitions)[number];
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
type TaskProjectRow = Tables<'tasks_projects'>;
type TaskHeadingRow = Tables<'tasks_headings'>;
type TaskChecklistItemRow = Tables<'tasks_checklist_items'>;
type TaskMailSourceRow = Tables<'tasks_mail_sources'>;
type TaskMailSourceEventRow = Tables<'tasks_mail_source_events'>;
type TaskHierarchyOperationRow = Tables<'tasks_hierarchy_operations'>;
type TaskHierarchyHistoryRow = Tables<'tasks_hierarchy_history_events'>;

type RefinedTaskFields = {
  lifecycle: TaskLifecycle;
  disposition: TaskDisposition;
  destination: TaskDestination;
  today_section: TaskTodaySection;
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

type RefinedProjectFields = RefinedHierarchyFields & {
  lifecycle: TaskLifecycle;
  destination: Exclude<TaskDestination, 'inbox'>;
  today_section: TaskTodaySection;
};

export type TaskArea = Omit<TaskAreaRow, keyof RefinedHierarchyFields> &
  RefinedHierarchyFields;

export type TaskProject = Omit<TaskProjectRow, keyof RefinedProjectFields> &
  RefinedProjectFields;

export type TaskHeading = Omit<TaskHeadingRow, keyof RefinedHierarchyFields> &
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
  transition: Exclude<TaskMutationTransition, 'undo'>;
};

export type TaskUserSettings = Tables<'tasks_user_settings'>;
