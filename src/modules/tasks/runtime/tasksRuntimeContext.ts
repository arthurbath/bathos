import type { PowerSyncDatabase } from '@powersync/web';
import { createContext, useContext } from 'react';

import type { TaskRepository } from '@/modules/tasks/data/taskRepository';

export type TasksRuntimeValue = {
  database: PowerSyncDatabase;
  repository: TaskRepository;
  mode: 'local' | 'connected';
  planningTimeZone: string;
  prepareForSignOut: () => Promise<void>;
};

export const TasksRuntimeContext = createContext<TasksRuntimeValue | null>(null);

export function useTasksRuntime(): TasksRuntimeValue {
  const runtime = useContext(TasksRuntimeContext);
  if (runtime === null) {
    throw new Error('useTasksRuntime must be used inside TasksRuntimeProvider');
  }
  return runtime;
}
