import { PowerSyncContext } from '@powersync/react';
import type { PowerSyncDatabase } from '@powersync/web';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { TaskPortabilityService } from '@/modules/tasks/data/taskPortability';
import {
  resolveTaskPlanningTimeZone,
  taskCalendarDateInTimeZone,
} from '@/modules/tasks/domain/taskDates';
import type { TasksSyncState } from '@/modules/tasks/domain/taskSyncReliability';
import {
  bindTasksDatabaseOwner,
  createTasksPowerSyncDatabase,
} from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import {
  TasksRuntimeContext,
  type TasksRuntimeValue,
} from '@/modules/tasks/runtime/tasksRuntimeContext';
import {
  observeTasksSyncState,
  resolveTasksSyncState,
} from '@/modules/tasks/runtime/tasksSyncState';
import { prepareTasksForSignOut } from '@/modules/tasks/runtime/taskSignOut';
import { TasksSyncReliabilityObserver } from '@/modules/tasks/runtime/TasksSyncReliabilityObserver';
import {
  prepareTasksOfflineLaunch,
  type TasksOfflineLaunchState,
} from '@/modules/tasks/pwa/taskServiceWorker';
import { activateTaskPlanningDate } from '@/modules/tasks/runtime/taskPlanningDate';
import {
  reportTasksRuntimeStartupFailure,
  type TasksRuntimeStartupPhase,
} from '@/modules/tasks/runtime/taskRuntimeStartupReporting';
import {
  createAutomaticTasksRuntimeReplacement,
  createTasksRuntimeRecoveryController,
  isClosedTasksRuntimeClientError,
  isCurrentTasksRuntimeGeneration,
  normalizeTasksRuntimeError,
  TASKS_RUNTIME_ERROR_MESSAGE,
  TASKS_RUNTIME_ERROR_TITLE,
  TASKS_RUNTIME_INITIALIZATION_TIMEOUT_MS,
  waitForTasksRuntimeInitialization,
} from '@/modules/tasks/runtime/taskRuntimeRecovery';

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
    | { status: 'error' }
  >({ status: 'loading' });
  const [syncState, setSyncState] = useState<TasksSyncState>(
    import.meta.env.VITE_TASKS_POWERSYNC_ENDPOINT?.trim() ? 'connecting' : 'local',
  );
  const [offlineLaunchState, setOfflineLaunchState] = useState<TasksOfflineLaunchState>('preparing');
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [database, setDatabase] = useState<PowerSyncDatabase>(createTasksPowerSyncDatabase);
  const [recoveryController] = useState(createTasksRuntimeRecoveryController);
  const runtimeGenerationRef = useRef(0);
  const reportedGenerationRef = useRef<number | null>(null);
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
  const portabilityService = useMemo(() => new TaskPortabilityService(supabase), []);

  useEffect(() => {
    let active = true;
    const prepare = () => {
      if (!active) return;
      setOfflineLaunchState('preparing');
      void prepareTasksOfflineLaunch().then((nextState) => {
        if (active) setOfflineLaunchState(nextState);
      });
    };

    prepare();
    window.addEventListener('online', prepare);
    return () => {
      active = false;
      window.removeEventListener('online', prepare);
    };
  }, []);

  useEffect(() => {
    const generation = runtimeGenerationRef.current + 1;
    runtimeGenerationRef.current = generation;
    let active = true;
    let initializationExpired = false;
    let startupPhase: TasksRuntimeStartupPhase = 'owner-binding';
    let disposeStatusListener: (() => void) | undefined;
    let queuePoll: ReturnType<typeof setInterval> | undefined;
    let activationPoll: ReturnType<typeof setInterval> | undefined;
    const endpoint = import.meta.env.VITE_TASKS_POWERSYNC_ENDPOINT?.trim();
    const isBrowserOnline = () => window.navigator.onLine !== false;
    const isCurrentGeneration = () => isCurrentTasksRuntimeGeneration(
      active,
      runtimeGenerationRef.current,
      generation,
    );
    const refreshBrowserNetworkState = () => {
      if (!isCurrentGeneration() || !endpoint) return;
      setSyncState(resolveTasksSyncState(database.currentStatus, isBrowserOnline()));
    };

    window.addEventListener('offline', refreshBrowserNetworkState);
    window.addEventListener('online', refreshBrowserNetworkState);

    const refreshQueueDepth = async () => {
      const queue = await database.getUploadQueueStats();
      if (isCurrentGeneration()) {
        setPendingUploadCount(queue.count);
      }
    };

    const failTerminally = (error: Error, phase: TasksRuntimeStartupPhase) => {
      if (!isCurrentGeneration()) return;
      if (reportedGenerationRef.current !== generation) {
        reportedGenerationRef.current = generation;
        reportTasksRuntimeStartupFailure(error, {
          phase,
          generation,
          outcome: 'terminal',
          automaticRecoveryAttempted: recoveryController.attempts > 0,
          closedClientError: isClosedTasksRuntimeClientError(error),
          endpointConfigured: Boolean(endpoint),
          browserOnline: isBrowserOnline(),
        });
      }
      setState({ status: 'error' });
    };

    const handleInitializationFailure = (
      caught: unknown,
      phase: TasksRuntimeStartupPhase,
    ) => {
      if (!isCurrentGeneration()) return;
      const error = normalizeTasksRuntimeError(caught);
      const nextDatabase = createAutomaticTasksRuntimeReplacement(
        error,
        recoveryController,
        database,
      );
      if (nextDatabase) {
        reportTasksRuntimeStartupFailure(error, {
          phase,
          generation,
          outcome: 'automatic-recovery-started',
          automaticRecoveryAttempted: true,
          closedClientError: true,
          endpointConfigured: Boolean(endpoint),
          browserOnline: isBrowserOnline(),
        });
        setState({ status: 'loading' });
        setDatabase(nextDatabase);
        return;
      }
      failTerminally(error, phase);
    };

    const initialize = async () => {
      try {
        startupPhase = 'owner-binding';
        await bindTasksDatabaseOwner(database, ownerId);
        if (!isCurrentGeneration() || initializationExpired) return;
        startupPhase = 'planning-settings';
        const settings = await repository.ensurePlanningSettings(
          ownerId,
          resolveTaskPlanningTimeZone(),
        );
        if (!isCurrentGeneration() || initializationExpired) return;
        const activateReachedDates = async () => {
          const planningDate = taskCalendarDateInTimeZone(
            settings.planning_timezone,
            new Date(),
          );
          await activateTaskPlanningDate({
            ownerId,
            planningDate,
            planningTimeZone: settings.planning_timezone,
            repository,
          });
        };
        startupPhase = 'planning-date-activation';
        await activateReachedDates();
        if (!isCurrentGeneration() || initializationExpired) return;
        activationPoll = setInterval(() => {
          if (isCurrentGeneration()) {
            void activateReachedDates().catch(() => undefined);
          }
        }, 60_000);
        if (!isCurrentGeneration()) {
          return;
        }

        recoveryController.reset();
        setState({
          status: 'ready',
          mode: endpoint ? 'connected' : 'local',
          planningTimeZone: settings.planning_timezone,
        });
        if (endpoint) {
          const connector = createTasksSupabaseConnector({ endpoint, supabase });
          setSyncState('connecting');
          disposeStatusListener = observeTasksSyncState(
            database,
            (nextSyncState) => {
              if (!isCurrentGeneration()) {
                return;
              }
              setSyncState(nextSyncState);
              void refreshQueueDepth().catch(() => undefined);
            },
            isBrowserOnline,
          );
          await refreshQueueDepth();
          queuePoll = setInterval(() => {
            if (isCurrentGeneration()) {
              void refreshQueueDepth().catch(() => undefined);
            }
          }, 1_000);
          try {
            await database.connect(connector);
          } catch {
            if (isCurrentGeneration()) {
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
        if (!initializationExpired) {
          handleInitializationFailure(error, startupPhase);
        }
      }
    };

    void waitForTasksRuntimeInitialization(
      initialize(),
      TASKS_RUNTIME_INITIALIZATION_TIMEOUT_MS,
      () => {
        initializationExpired = true;
      },
    ).catch((error) => {
      if (isCurrentGeneration()) {
        handleInitializationFailure(error, 'watchdog');
      }
    });

    return () => {
      active = false;
      window.removeEventListener('offline', refreshBrowserNetworkState);
      window.removeEventListener('online', refreshBrowserNetworkState);
      disposeStatusListener?.();
      if (queuePoll !== undefined) {
        clearInterval(queuePoll);
      }
      if (activationPoll !== undefined) {
        clearInterval(activationPoll);
      }
      void database.close().catch(() => undefined);
    };
  }, [database, hierarchyRepository, ownerId, recoveryController, repository]);

  const prepareForSignOut = useCallback(async () => {
    await prepareTasksForSignOut({
      database,
      reminderService,
      mode: state.status === 'ready' ? state.mode : 'local',
    });
  }, [database, reminderService, state]);

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
      portabilityService,
      mode: state.status === 'ready' ? state.mode : 'local',
      syncState,
      offlineLaunchState,
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
      portabilityService,
      templateService,
      syncState,
      offlineLaunchState,
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
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            {TASKS_RUNTIME_ERROR_TITLE}
          </h1>
          <p className="text-sm text-muted-foreground">
            {TASKS_RUNTIME_ERROR_MESSAGE}
          </p>
          <Button type="button" variant="outline" onClick={() => {
            recoveryController.reset();
            setState({ status: 'loading' });
            const nextDatabase = createTasksPowerSyncDatabase();
            void database.close()
              .catch(() => undefined)
              .finally(() => {
                setDatabase(nextDatabase);
              });
          }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PowerSyncContext.Provider value={database}>
      <TasksRuntimeContext.Provider value={runtime}>
        <TasksSyncReliabilityObserver />
        {children}
      </TasksRuntimeContext.Provider>
    </PowerSyncContext.Provider>
  );
}
