import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  parseTaskReminder,
  type TaskDueReminder,
  type TaskReminderSaveInput,
} from '@/modules/tasks/data/taskReminderService';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskReminder } from '@/modules/tasks/types/tasks';
import { useTaskWebPush } from '@/modules/tasks/hooks/useTaskWebPush';

const CLAIM_INTERVAL_MS = 60_000;

export function useTaskReminders(ownerId: string) {
  const { mode, planningTimeZone, reminderService } = useTasksRuntime();
  const webPush = useTaskWebPush(mode, reminderService);
  const remindersQuery = useQuery<TaskReminder>(
    `SELECT * FROM tasks_reminders
     WHERE owner_id = ? AND status = 'active'
     ORDER BY resolved_at, id`,
    [ownerId],
  );
  const [optimistic, setOptimistic] = useState<Record<string, TaskReminder | null>>({});
  const [dueItems, setDueItems] = useState<TaskDueReminder[]>([]);
  const [claimError, setClaimError] = useState<Error | null>(null);
  const claiming = useRef(false);

  const queried = useMemo(
    () => remindersQuery.data.map(parseTaskReminder),
    [remindersQuery.data],
  );

  useEffect(() => {
    setOptimistic((current) => {
      const next = { ...current };
      for (const [id, row] of Object.entries(next)) {
        const remote = queried.find((reminder) => reminder.id === id);
        if ((row === null && !remote) || (row && remote?.client_mutation_id === row.client_mutation_id)) {
          delete next[id];
        }
      }
      return next;
    });
  }, [queried]);

  const reminders = useMemo(() => {
    const rows = new Map(queried.map((reminder) => [reminder.id, reminder]));
    for (const [id, reminder] of Object.entries(optimistic)) {
      if (reminder === null) rows.delete(id);
      else rows.set(id, reminder);
    }
    return Array.from(rows.values()).sort((left, right) => (
      left.resolved_at.localeCompare(right.resolved_at) || left.id.localeCompare(right.id)
    ));
  }, [optimistic, queried]);

  const byRootId = useMemo(
    () => new Map(reminders.map((reminder) => [
      reminder.task_id ?? reminder.project_id!,
      reminder,
    ])),
    [reminders],
  );

  const claimDue = useCallback(async () => {
    if (mode !== 'connected' || claiming.current || document.visibilityState === 'hidden') return;
    claiming.current = true;
    try {
      const result = await reminderService.claimDue();
      if (result.items.length > 0) {
        setDueItems((current) => {
          const rows = new Map(current.map((item) => [item.delivery_id, item]));
          for (const item of result.items) rows.set(item.delivery_id, item);
          return Array.from(rows.values()).sort((left, right) => (
            left.resolved_at.localeCompare(right.resolved_at)
          ));
        });
      }
      setClaimError(null);
    } catch (error) {
      setClaimError(error instanceof Error ? error : new Error('Unable to check due reminders'));
    } finally {
      claiming.current = false;
    }
  }, [mode, reminderService]);

  useEffect(() => {
    if (mode !== 'connected') return;
    void claimDue();
    const interval = window.setInterval(() => void claimDue(), CLAIM_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void claimDue();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [claimDue, mode]);

  const save = useCallback(async (
    input: Omit<TaskReminderSaveInput, 'timeZone'> & { timeZone?: string },
  ) => {
    if (mode !== 'connected') throw new Error('Reminder changes require connected task storage');
    const result = await reminderService.save({
      ...input,
      timeZone: input.timeZone ?? planningTimeZone,
    });
    if (result.outcome === 'conflict') {
      throw new Error('The reminder changed before it could be saved');
    }
    setOptimistic((current) => ({ ...current, [result.reminder.id]: result.reminder }));
    return result;
  }, [mode, planningTimeZone, reminderService]);

  const cancel = useCallback(async (reminder: TaskReminder) => {
    if (mode !== 'connected') throw new Error('Reminder changes require connected task storage');
    const result = await reminderService.cancel(reminder);
    if (result.outcome === 'conflict') {
      throw new Error('The reminder changed before it could be canceled');
    }
    setOptimistic((current) => ({ ...current, [reminder.id]: null }));
    return result;
  }, [mode, reminderService]);

  const acknowledge = useCallback(async (deliveryId: string) => {
    await reminderService.acknowledge(deliveryId);
    setDueItems((current) => current.filter((item) => item.delivery_id !== deliveryId));
  }, [reminderService]);

  return {
    reminders,
    byRootId,
    dueItems,
    claimError,
    mode,
    planningTimeZone,
    loading: remindersQuery.isLoading,
    error: remindersQuery.error ?? claimError,
    save,
    cancel,
    acknowledge,
    claimDue,
    webPush,
  };
}

export type TaskRemindersModel = ReturnType<typeof useTaskReminders>;
