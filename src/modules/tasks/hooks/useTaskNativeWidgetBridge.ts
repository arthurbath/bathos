import { useQuery } from '@powersync/react';
import { useEffect, useMemo, useRef } from 'react';

import type { TaskQuickFilter } from '@/modules/tasks/domain/taskQuickFilters';
import {
  buildTaskNativeWidgetSnapshot,
  publishTaskNativeWidgetSnapshot,
  publishTaskNativeWidgetCredential,
} from '@/modules/tasks/native/taskNativeWidgetBridge';
import type { TaskArea, TaskTodo } from '@/modules/tasks/types/tasks';
import { supabase } from '@/integrations/supabase/client';
import { getTasksNativeInstallationId } from '@/platform/native/tasksNativeCompanion';

export function useTaskNativeWidgetBridge({
  ownerId,
  planningDate,
  areas,
  automaticListSorting,
  quickFilter,
}: {
  ownerId: string;
  planningDate: string;
  areas: readonly TaskArea[];
  automaticListSorting: boolean;
  quickFilter: TaskQuickFilter;
}): void {
  const provisionedCredentialKeyRef = useRef<string | null>(null);
  const query = useQuery<TaskTodo>(
    `SELECT *
     FROM tasks_todos
     WHERE owner_id = ?
       AND recurrence_superseded_at IS NULL
       AND (
         (disposition = 'present' AND lifecycle IN ('open', 'completed', 'canceled'))
         OR (disposition = 'deleted' AND deletion_root_id = id)
       )
     ORDER BY id`,
    [ownerId],
  );
  const snapshot = useMemo(() => buildTaskNativeWidgetSnapshot({
    ownerId,
    planningDate,
    tasks: query.data,
    areas,
    automaticListSorting,
    quickFilter,
  }), [
    areas,
    automaticListSorting,
    ownerId,
    planningDate,
    query.data,
    quickFilter,
  ]);

  useEffect(() => {
    if (query.isLoading || query.error) return;
    publishTaskNativeWidgetSnapshot(snapshot);
  }, [query.error, query.isLoading, snapshot]);

  useEffect(() => {
    const installationId = getTasksNativeInstallationId();
    if (!installationId) return;
    const credentialKey = `${ownerId}:${installationId}`;
    if (provisionedCredentialKeyRef.current === credentialKey) return;
    provisionedCredentialKeyRef.current = credentialKey;
    let cancelled = false;

    void supabase.functions.invoke('tasks-widget-actions', {
      body: { action: 'issue', installationId },
    }).then(({ data, error }) => {
      if (cancelled || error || typeof data !== 'object' || data === null) {
        provisionedCredentialKeyRef.current = null;
        return;
      }
      const result = data as Record<string, unknown>;
      if (
        result.outcome !== 'issued'
        || result.ownerId !== ownerId
        || result.installationId !== installationId
        || typeof result.credential !== 'string'
        || typeof result.expiresAt !== 'string'
      ) {
        provisionedCredentialKeyRef.current = null;
        return;
      }
      publishTaskNativeWidgetCredential({
        ownerId,
        installationId,
        credential: result.credential,
        expiresAt: result.expiresAt,
      });
    }).catch(() => {
      provisionedCredentialKeyRef.current = null;
    });

    return () => {
      cancelled = true;
    };
  }, [ownerId]);
}
