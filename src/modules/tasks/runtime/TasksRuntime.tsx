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
    { status: 'loading' } | { status: 'ready'; mode: 'local' | 'connected' } | { status: 'error'; error: Error }
  >({ status: 'loading' });
  const [database, setDatabase] = useState<PowerSyncDatabase>(createTasksPowerSyncDatabase);
  const repository = useMemo(() => new TaskRepository(database), [database]);

  useEffect(() => {
    let active = true;
    const endpoint = import.meta.env.VITE_TASKS_POWERSYNC_ENDPOINT?.trim();

    void (async () => {
      try {
        await bindTasksDatabaseOwner(database, ownerId);
        if (!active) {
          return;
        }

        setState({ status: 'ready', mode: endpoint ? 'connected' : 'local' });
        if (endpoint) {
          const connector = createTasksSupabaseConnector({ endpoint, supabase });
          try {
            await database.connect(connector);
          } catch {
            if (active) {
              setState({ status: 'ready', mode: 'local' });
            }
          }
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
      void database.close().catch(() => undefined);
    };
  }, [database, ownerId]);

  const prepareForSignOut = useCallback(
    () => clearTasksDatabaseForSignOut(database),
    [database],
  );

  const runtime = useMemo<TasksRuntimeValue>(
    () => ({
      database,
      repository,
      mode: state.status === 'ready' ? state.mode : 'local',
      prepareForSignOut,
    }),
    [database, prepareForSignOut, repository, state],
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
