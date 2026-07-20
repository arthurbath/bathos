import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { TaskDisposition, TaskLifecycle } from '@/modules/tasks/domain/taskState';

export const taskDestinations = ['inbox', 'today'] as const;
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

export type TaskDestination = (typeof taskDestinations)[number];
export type TaskEntryChannel = (typeof taskEntryChannels)[number];
export type TaskSourceKind = (typeof taskSourceKinds)[number];

type TaskTodoRow = Tables<'tasks_todos'>;
type TaskTodoInsertRow = TablesInsert<'tasks_todos'>;
type TaskTodoUpdateRow = TablesUpdate<'tasks_todos'>;

type RefinedTaskFields = {
  lifecycle: TaskLifecycle;
  disposition: TaskDisposition;
  destination: TaskDestination;
  entry_channel: TaskEntryChannel;
  source_kind: TaskSourceKind | null;
};

export type TaskTodo = Omit<TaskTodoRow, keyof RefinedTaskFields> & RefinedTaskFields;

export type TaskTodoInsert = Omit<TaskTodoInsertRow, keyof RefinedTaskFields> &
  Partial<RefinedTaskFields>;

export type TaskTodoUpdate = Omit<TaskTodoUpdateRow, keyof RefinedTaskFields> &
  Partial<RefinedTaskFields>;
