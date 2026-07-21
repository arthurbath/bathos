import type { PowerSyncDatabase } from '@powersync/web';
import { createContext, useContext } from 'react';

import type { TaskRepository } from '@/modules/tasks/data/taskRepository';
import type { TaskHierarchyRepository } from '@/modules/tasks/data/taskHierarchyRepository';
import type { TaskHierarchyOperationsRepository } from '@/modules/tasks/data/taskHierarchyOperationsRepository';
import type { TaskTemplateService } from '@/modules/tasks/data/taskTemplateService';
import type { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import type { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import type { TaskPermanentDeletionService } from '@/modules/tasks/data/taskPermanentDeletionService';
import type { TaskPortabilityService } from '@/modules/tasks/data/taskPortability';
import type { TasksSyncState } from '@/modules/tasks/domain/taskSyncReliability';

export type TasksRuntimeValue = {
  database: PowerSyncDatabase;
  repository: TaskRepository;
  hierarchyRepository: TaskHierarchyRepository;
  hierarchyOperationsRepository: TaskHierarchyOperationsRepository;
  templateService: TaskTemplateService;
  recurrenceService: TaskRecurrenceService;
  reminderService: TaskReminderService;
  permanentDeletionService: TaskPermanentDeletionService;
  portabilityService: TaskPortabilityService;
  mode: 'local' | 'connected';
  syncState: TasksSyncState;
  pendingUploadCount: number;
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
