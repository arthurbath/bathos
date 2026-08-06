import { useQuery } from '@powersync/react';
import { useEffect, useMemo, useRef } from 'react';

import type { TaskQuickFilter } from '@/modules/tasks/domain/taskQuickFilters';
import {
  buildTaskNativeWidgetSnapshot,
  publishTaskNativeQuickEntryCredential,
  publishTaskNativeWidgetSnapshot,
  publishTaskNativeWidgetCredential,
} from '@/modules/tasks/native/taskNativeWidgetBridge';
import {
  maintainTaskNativeQuickEntryCredential,
  maintainTaskNativeWidgetCredential,
} from '@/modules/tasks/native/taskNativeWidgetCredential';
import type {
  TaskArea,
  TaskRecurrenceDefinition,
  TaskRecurrenceRevision,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import { supabase } from '@/integrations/supabase/client';
import { getTasksNativeInstallationId } from '@/platform/native/tasksNativeCompanion';

export function useTaskNativeWidgetBridge({
  ownerId,
  planningDate,
  areas,
  automaticListSorting,
  quickFilter,
  recurrencePrototypes,
}: {
  ownerId: string;
  planningDate: string;
  areas: readonly TaskArea[];
  automaticListSorting: boolean;
  quickFilter: TaskQuickFilter;
  recurrencePrototypes: ReadonlyArray<{
    definition: TaskRecurrenceDefinition;
    revision: TaskRecurrenceRevision;
    scheduledDate: string;
  }>;
}): void {
  const provisionedCredentialKeyRef = useRef<string | null>(null);
  const provisionedQuickEntryCredentialKeyRef = useRef<string | null>(null);
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
    recurrencePrototypes,
  }), [
    areas,
    automaticListSorting,
    ownerId,
    planningDate,
    query.data,
    quickFilter,
    recurrencePrototypes,
  ]);

  useEffect(() => {
    if (
      query.isLoading
      || query.error
    ) return;
    publishTaskNativeWidgetSnapshot(snapshot);
  }, [
    query.error,
    query.isLoading,
    snapshot,
  ]);

  useEffect(() => {
    const installationId = getTasksNativeInstallationId();
    if (!installationId) return;
    const credentialKey = `${ownerId}:${installationId}`;
    if (provisionedCredentialKeyRef.current === credentialKey) return;
    const controller = new AbortController();

    void maintainTaskNativeWidgetCredential({
      ownerId,
      installationId,
      signal: controller.signal,
      issue: async () => {
        const { data, error } = await supabase.functions.invoke(
          'tasks-widget-actions',
          { body: { action: 'issue', installationId } },
        );
        return error ? null : data;
      },
      publish: publishTaskNativeWidgetCredential,
    }).then((provisioned) => {
      if (provisioned && !controller.signal.aborted) {
        provisionedCredentialKeyRef.current = credentialKey;
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        provisionedCredentialKeyRef.current = null;
      }
    });

    return () => controller.abort();
  }, [ownerId]);

  useEffect(() => {
    const installationId = getTasksNativeInstallationId();
    if (!installationId) return;
    const credentialKey = `${ownerId}:${installationId}`;
    if (provisionedQuickEntryCredentialKeyRef.current === credentialKey) return;
    const controller = new AbortController();

    void maintainTaskNativeQuickEntryCredential({
      ownerId,
      installationId,
      signal: controller.signal,
      issue: async () => {
        const { data, error } = await supabase.functions.invoke(
          'tasks-widget-actions',
          { body: { action: 'issueQuickEntry', installationId } },
        );
        return error ? null : data;
      },
      publish: publishTaskNativeQuickEntryCredential,
    }).then((provisioned) => {
      if (provisioned && !controller.signal.aborted) {
        provisionedQuickEntryCredentialKeyRef.current = credentialKey;
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        provisionedQuickEntryCredentialKeyRef.current = null;
      }
    });

    return () => controller.abort();
  }, [ownerId]);
}
