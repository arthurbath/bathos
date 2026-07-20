import { PowerSyncContext } from '@powersync/react';
import type { PowerSyncDatabase } from '@powersync/web';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { TaskHierarchyRepository } from '@/modules/tasks/data/taskHierarchyRepository';
import { TaskHierarchyOperationsRepository } from '@/modules/tasks/data/taskHierarchyOperationsRepository';
import { TaskTemplateService } from '@/modules/tasks/data/taskTemplateService';
import { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import { TaskPermanentDeletionService } from '@/modules/tasks/data/taskPermanentDeletionService';
import { resolveTaskPlanningTimeZone } from '@/modules/tasks/domain/taskDates';
import type { TasksSyncState } from '@/modules/tasks/components/tasksStorageStatus';
import {
  bindTasksDatabaseOwner,
  clearTasksDatabaseForSignOut,
  createTasksPowerSyncDatabase,
} from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import {
  TasksRuntimeContext,
  type TasksRuntimeValue,
} from '@/modules/tasks/runtime/tasksRuntimeContext';

export function TasksRuntimeProvider({
  ownerId,
  children,
}: {
  ownerId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; mode: 'local' | 'connected'; planningTimeZone: string }
    | { status: 'error'; error: Error }
  >({ status: 'loading' });
  const [syncState, setSyncState] = useState<TasksSyncState>(
    import.meta.env.VITE_TASKS_POWERSYNC_ENDPOINT?.trim() ? 'connecting' : 'local',
  );
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [database, setDatabase] = useState<PowerSyncDatabase>(createTasksPowerSyncDatabase);
  const repository = useMemo(() => new TaskRepository(database), [database]);
  const hierarchyRepository = useMemo(
    () => new TaskHierarchyRepository(database),
    [database],
  );
  const hierarchyOperationsRepository = useMemo(
    () => new TaskHierarchyOperationsRepository(database),
    [database],
  );
  const templateService = useMemo(
    () => new TaskTemplateService(supabase, ownerId),
    [ownerId],
  );
  const recurrenceService = useMemo(
    () => new TaskRecurrenceService(supabase, ownerId),
    [ownerId],
  );
  const reminderService = useMemo(() => new TaskReminderService(supabase), []);
  const permanentDeletionService = useMemo(
    () => new TaskPermanentDeletionService(supabase),
    [],
  );

  useEffect(() => {
    let active = true;
    let disposeStatusListener: (() => void) | undefined;
    let queuePoll: ReturnType<typeof setInterval> | undefined;
    const endpoint = import.meta.env.VITE_TASKS_POWERSYNC_ENDPOINT?.trim();

    const refreshQueueDepth = async () => {
      const queue = await database.getUploadQueueStats();
      if (active) {
        setPendingUploadCount(queue.count);
      }
    };

    void (async () => {
      try {
        await bindTasksDatabaseOwner(database, ownerId);
        const settings = await repository.ensurePlanningSettings(
          ownerId,
          resolveTaskPlanningTimeZone(),
        );
        if (!active) {
          return;
        }

        setState({
          status: 'ready',
          mode: endpoint ? 'connected' : 'local',
          planningTimeZone: settings.planning_timezone,
        });
        if (endpoint) {
          const connector = createTasksSupabaseConnector({ endpoint, supabase });
          setSyncState('connecting');
          disposeStatusListener = database.registerListener({
            statusChanged: (status) => {
              if (!active) {
                return;
              }
              setSyncState(status.connected ? 'connected' : status.connecting ? 'connecting' : 'offline');
              void refreshQueueDepth().catch(() => undefined);
            },
          });
          await refreshQueueDepth();
          queuePoll = setInterval(() => {
            void refreshQueueDepth().catch(() => undefined);
          }, 1_000);
          try {
            await database.connect(connector);
          } catch {
            if (active) {
              setSyncState('offline');
              setState({
                status: 'ready',
                mode: 'connected',
                planningTimeZone: settings.planning_timezone,
              });
            }
          }
        } else {
          setSyncState('local');
          setPendingUploadCount(0);
        }
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error('Unable to open local task data'),
          });
        }
      }
    })();

    return () => {
      active = false;
      disposeStatusListener?.();
      if (queuePoll !== undefined) {
        clearInterval(queuePoll);
      }
      void database.close().catch(() => undefined);
    };
  }, [database, ownerId, repository]);

  const prepareForSignOut = useCallback(
    () => clearTasksDatabaseForSignOut(database),
    [database],
  );

  const runtime = useMemo<TasksRuntimeValue>(
    () => ({
      database,
      repository,
      hierarchyRepository,
      hierarchyOperationsRepository,
      templateService,
      recurrenceService,
      reminderService,
      permanentDeletionService,
      mode: state.status === 'ready' ? state.mode : 'local',
      syncState,
      pendingUploadCount,
      planningTimeZone: state.status === 'ready' ? state.planningTimeZone : 'UTC',
      prepareForSignOut,
    }),
    [
      database,
      hierarchyOperationsRepository,
      hierarchyRepository,
      prepareForSignOut,
      repository,
      recurrenceService,
      reminderService,
      permanentDeletionService,
      templateService,
      syncState,
      pendingUploadCount,
      state,
    ],
  );

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg space-y-4 text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Tasks Could Not Open</h1>
          <p className="text-sm text-muted-foreground">{state.error.message}</p>
          <Button type="button" variant="outline" onClick={() => {
            setState({ status: 'loading' });
            setDatabase(createTasksPowerSyncDatabase());
          }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PowerSyncContext.Provider value={database}>
      <TasksRuntimeContext.Provider value={runtime}>{children}</TasksRuntimeContext.Provider>
    </PowerSyncContext.Provider>
  );
}
