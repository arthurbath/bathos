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
  assertTasksDatabaseSchemaCompatibility,
  createTasksPowerSyncDatabase,
  getTasksPowerSyncDatabaseGeneration,
  TasksDatabaseSchemaCompatibilityError,
} from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import {
  TasksRuntimeContext,
  type TasksRuntimeValue,
} from '@/modules/tasks/runtime/tasksRuntimeContext';
import {
  observeTasksSyncState,
  resolveTasksSyncState,
  shouldReleaseTasksStartupRefresh,
  type TasksPowerSyncStatus,
} from '@/modules/tasks/runtime/tasksSyncState';
import { prepareTasksForSignOut } from '@/modules/tasks/runtime/taskSignOut';
import { TasksSyncReliabilityObserver } from '@/modules/tasks/runtime/TasksSyncReliabilityObserver';
import {
  prepareTasksOfflineLaunch,
  type TasksOfflineLaunchState,
} from '@/modules/tasks/pwa/taskServiceWorker';
import {
  activateTaskPlanningDate,
  shouldActivateTaskPlanningDate,
  taskQueuePollDelay,
} from '@/modules/tasks/runtime/taskPlanningDate';
import {
  reportTasksRuntimeStartupFailure,
  type TasksRuntimeStartupPhase,
} from '@/modules/tasks/runtime/taskRuntimeStartupReporting';
import {
  reportTasksRuntimeCacheRecovery,
} from '@/modules/tasks/runtime/taskRuntimeCacheRecoveryReporting';
import {
  createAutomaticCorruptTasksCacheReplacement,
  createAutomaticTasksRuntimeReplacement,
  createTasksCorruptCacheRecoveryController,
  createTasksRuntimeRecoveryController,
  isClosedTasksRuntimeClientError,
  isCurrentTasksRuntimeGeneration,
  isTasksDatabaseCorruptionError,
  isTasksRecoverableCacheError,
  normalizeTasksRuntimeError,
  TASKS_RUNTIME_ERROR_MESSAGE,
  TASKS_RUNTIME_ERROR_TITLE,
  TASKS_RUNTIME_INITIALIZATION_TIMEOUT_MS,
  waitForTasksRuntimeInitialization,
} from '@/modules/tasks/runtime/taskRuntimeRecovery';

export const TASKS_STARTUP_REFRESH_TIMEOUT_MS = 15_000;
export const TASKS_NATIVE_APP_ACTIVE_EVENT = 'bathos:tasks-native-app-active';

export function TasksRuntimeProvider({
  ownerId,
  children,
}: {
  ownerId: string;
  children: ReactNode;
}) {
  const configuredEndpoint = import.meta.env.VITE_TASKS_POWERSYNC_ENDPOINT?.trim();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; mode: 'local' | 'connected'; planningTimeZone: string }
    | { status: 'error' }
  >({ status: 'loading' });
  const [syncState, setSyncState] = useState<TasksSyncState>(
    configuredEndpoint ? 'connecting' : 'local',
  );
  const [startupRefreshPending, setStartupRefreshPending] = useState(
    () => Boolean(configuredEndpoint) && window.navigator.onLine !== false,
  );
  const [offlineLaunchState, setOfflineLaunchState] = useState<TasksOfflineLaunchState>('preparing');
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [database, setDatabase] = useState<PowerSyncDatabase>(createTasksPowerSyncDatabase);
  const [recoveryController] = useState(createTasksRuntimeRecoveryController);
  const [corruptCacheRecoveryController] = useState(
    createTasksCorruptCacheRecoveryController,
  );
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
    let queuePoll: ReturnType<typeof setTimeout> | undefined;
    let activationPoll: ReturnType<typeof setInterval> | undefined;
    let startupRefreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let startupSyncBaseline: number | null = null;
    let startupSyncBaselineCaptured = false;
    let nativeReconnectInFlight: Promise<void> | null = null;
    let queueRefreshInFlight: Promise<number> | null = null;
    let lastKnownQueueDepth = 0;
    let activateReachedDates: (() => Promise<void>) | null = null;
    let planningActivationInFlight: Promise<void> | null = null;
    let lastActivatedPlanningDate: string | null = null;
    let corruptCacheRecoveryInFlight: Promise<void> | null = null;
    let corruptCacheRecoveryStarted = false;
    const endpoint = configuredEndpoint;
    const connector = endpoint
      ? createTasksSupabaseConnector({ endpoint, supabase })
      : null;
    const isBrowserOnline = () => window.navigator.onLine !== false;
    const isCurrentGeneration = () => isCurrentTasksRuntimeGeneration(
      active,
      runtimeGenerationRef.current,
      generation,
    );
    const releaseStartupRefresh = () => {
      if (startupRefreshTimeout !== undefined) {
        clearTimeout(startupRefreshTimeout);
        startupRefreshTimeout = undefined;
      }
      if (isCurrentGeneration()) {
        setStartupRefreshPending(false);
      }
    };
    const beginStartupRefresh = () => {
      if (!endpoint || !isBrowserOnline()) {
        releaseStartupRefresh();
        return;
      }
      setStartupRefreshPending(true);
      startupRefreshTimeout = setTimeout(
        releaseStartupRefresh,
        TASKS_STARTUP_REFRESH_TIMEOUT_MS,
      );
    };
    const observeStartupFreshness = (status: TasksPowerSyncStatus) => {
      if (shouldReleaseTasksStartupRefresh({
        browserOnline: isBrowserOnline(),
        baselineCaptured: startupSyncBaselineCaptured,
        baselineLastSyncedAt: startupSyncBaseline,
        status,
      })) {
        releaseStartupRefresh();
      }
    };
    const refreshBrowserNetworkState = () => {
      if (!isCurrentGeneration() || !endpoint) return;
      if (!isBrowserOnline()) {
        releaseStartupRefresh();
      }
      setSyncState(resolveTasksSyncState(database.currentStatus, isBrowserOnline()));
    };

    const refreshNativeAppSync = () => {
      if (!isCurrentGeneration() || !connector || !isBrowserOnline()) {
        return;
      }
      beginStartupRefresh();
      setSyncState('connecting');
      if (nativeReconnectInFlight) {
        void activateReachedDates?.().catch(() => undefined);
        return;
      }
      void activateReachedDates?.().catch(() => undefined);
      nativeReconnectInFlight = database.connect(connector)
        .catch(() => {
          if (isCurrentGeneration() && !corruptCacheRecoveryStarted) {
            releaseStartupRefresh();
            setSyncState('offline');
          }
        })
        .finally(() => {
          nativeReconnectInFlight = null;
        });
    };

    beginStartupRefresh();

    window.addEventListener('offline', refreshBrowserNetworkState);
    window.addEventListener('online', refreshBrowserNetworkState);
    window.addEventListener(TASKS_NATIVE_APP_ACTIVE_EVENT, refreshNativeAppSync);

    const refreshQueueDepth = (): Promise<number> => {
      if (queueRefreshInFlight) return queueRefreshInFlight;
      queueRefreshInFlight = database.getUploadQueueStats()
        .then((queue) => {
          lastKnownQueueDepth = queue.count;
          if (isCurrentGeneration()) {
            setPendingUploadCount(queue.count);
          }
          return queue.count;
        })
        .finally(() => {
          queueRefreshInFlight = null;
        });
      return queueRefreshInFlight;
    };
    const scheduleQueuePoll = () => {
      if (!isCurrentGeneration()) return;
      if (queuePoll !== undefined) clearTimeout(queuePoll);
      queuePoll = setTimeout(() => {
        queuePoll = undefined;
        void refreshQueueDepth()
          .catch(() => lastKnownQueueDepth)
          .finally(scheduleQueuePoll);
      }, taskQueuePollDelay(lastKnownQueueDepth));
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

    const recoverCorruptCache = (error: unknown) => {
      if (
        !isCurrentGeneration()
        || corruptCacheRecoveryInFlight
        || corruptCacheRecoveryStarted
        || !isTasksRecoverableCacheError(error)
      ) {
        return;
      }
      corruptCacheRecoveryStarted = true;

      if (startupRefreshTimeout !== undefined) {
        clearTimeout(startupRefreshTimeout);
        startupRefreshTimeout = undefined;
      }
      setStartupRefreshPending(true);
      setSyncState('connecting');
      setState({ status: 'loading' });

      corruptCacheRecoveryInFlight = createAutomaticCorruptTasksCacheReplacement(
        error,
        corruptCacheRecoveryController,
        database,
      ).then((result) => {
        if (!isCurrentGeneration()) return;
        if (result.outcome === 'replacement-created') {
          reportTasksRuntimeCacheRecovery({
            failureClass: error instanceof TasksDatabaseSchemaCompatibilityError
              ? 'schema-incompatible'
              : 'sqlite-corruption',
            queueSafety: 'empty',
            previousGeneration: result.previousGeneration,
            nextGeneration: result.nextGeneration,
            outcome: 'replacement-created',
          });
          setDatabase(result.replacement);
          return;
        }

        const queueSafety = result.outcome === 'queue-not-empty'
          ? 'nonempty'
          : result.outcome === 'circuit-open'
            ? 'empty'
            : 'unreadable';
        reportTasksRuntimeCacheRecovery({
          failureClass: error instanceof TasksDatabaseSchemaCompatibilityError
            ? 'schema-incompatible'
            : 'sqlite-corruption',
          queueSafety,
          previousGeneration: result.previousGeneration,
          nextGeneration: null,
          outcome: result.outcome === 'queue-not-empty'
            ? 'queue-not-empty'
            : result.outcome === 'circuit-open'
              ? 'circuit-open'
              : 'queue-unreadable',
          circuitReason: result.outcome === 'circuit-open'
            ? result.reason
            : null,
        });
        failTerminally(
          new Error('Local synchronized task cache could not be recovered safely'),
          'watchdog',
        );
      }).catch(() => {
        if (!isCurrentGeneration()) return;
        reportTasksRuntimeCacheRecovery({
          failureClass: error instanceof TasksDatabaseSchemaCompatibilityError
            ? 'schema-incompatible'
            : 'sqlite-corruption',
          queueSafety: 'empty',
          previousGeneration: getTasksPowerSyncDatabaseGeneration(database),
          nextGeneration: null,
          outcome: 'replacement-failed',
        });
        failTerminally(
          new Error('Local synchronized task cache replacement failed'),
          'watchdog',
        );
      }).finally(() => {
        corruptCacheRecoveryInFlight = null;
      });
    };

    const handleInitializationFailure = (
      caught: unknown,
      phase: TasksRuntimeStartupPhase,
    ) => {
      if (!isCurrentGeneration()) return;
      const error = normalizeTasksRuntimeError(caught);
      if (isTasksRecoverableCacheError(error)) {
        recoverCorruptCache(error);
        return;
      }
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
        startupPhase = 'schema-compatibility';
        await assertTasksDatabaseSchemaCompatibility(database);
        if (!isCurrentGeneration() || initializationExpired) return;
        startupPhase = 'owner-binding';
        await bindTasksDatabaseOwner(database, ownerId);
        if (!isCurrentGeneration() || initializationExpired) return;
        startupPhase = 'planning-settings';
        const settings = await repository.ensurePlanningSettings(
          ownerId,
          resolveTaskPlanningTimeZone(),
        );
        if (!isCurrentGeneration() || initializationExpired) return;
        activateReachedDates = async () => {
          const planningDate = taskCalendarDateInTimeZone(
            settings.planning_timezone,
            new Date(),
          );
          if (!shouldActivateTaskPlanningDate(lastActivatedPlanningDate, planningDate)) {
            return;
          }
          if (planningActivationInFlight) return planningActivationInFlight;
          planningActivationInFlight = activateTaskPlanningDate({
            ownerId,
            planningDate,
            planningTimeZone: settings.planning_timezone,
            repository,
          }).then(() => {
            lastActivatedPlanningDate = planningDate;
          }).finally(() => {
            planningActivationInFlight = null;
          });
          return planningActivationInFlight;
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
          if (!connector) {
            releaseStartupRefresh();
            return;
          }
          setSyncState('connecting');
          const baselineLastSyncedAt = database.currentStatus.lastSyncedAt;
          startupSyncBaseline = baselineLastSyncedAt instanceof Date
            && !Number.isNaN(baselineLastSyncedAt.getTime())
            ? baselineLastSyncedAt.getTime()
            : null;
          startupSyncBaselineCaptured = true;
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
            (status) => {
              const downloadError = status.dataFlowStatus?.downloadError;
              if (downloadError !== undefined && isTasksDatabaseCorruptionError(downloadError)) {
                recoverCorruptCache(downloadError);
                return;
              }
              observeStartupFreshness(status);
            },
          );
          await refreshQueueDepth();
          scheduleQueuePoll();
          try {
            await database.connect(connector);
          } catch {
            if (isCurrentGeneration() && !corruptCacheRecoveryStarted) {
              releaseStartupRefresh();
              setSyncState('offline');
              setState({
                status: 'ready',
                mode: 'connected',
                planningTimeZone: settings.planning_timezone,
              });
            }
          }
        } else {
          releaseStartupRefresh();
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
      window.removeEventListener(TASKS_NATIVE_APP_ACTIVE_EVENT, refreshNativeAppSync);
      disposeStatusListener?.();
      if (queuePoll !== undefined) {
        clearTimeout(queuePoll);
      }
      if (activationPoll !== undefined) {
        clearInterval(activationPoll);
      }
      if (startupRefreshTimeout !== undefined) {
        clearTimeout(startupRefreshTimeout);
      }
      void database.close().catch(() => undefined);
    };
  }, [
    configuredEndpoint,
    corruptCacheRecoveryController,
    database,
    hierarchyRepository,
    ownerId,
    recoveryController,
    repository,
  ]);

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
      recurrenceService,
      reminderService,
      permanentDeletionService,
      portabilityService,
      mode: state.status === 'ready' ? state.mode : 'local',
      syncState,
      startupRefreshPending,
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
      syncState,
      startupRefreshPending,
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
            corruptCacheRecoveryController.reset();
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
