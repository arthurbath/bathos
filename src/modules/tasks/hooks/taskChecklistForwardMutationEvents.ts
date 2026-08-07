import type { TaskActionJournalChange } from '@/modules/tasks/domain/taskActionJournal';

export const TASK_CHECKLIST_FORWARD_MUTATION_EVENT =
  'bathos:task-checklist-forward-mutation';

export type TaskChecklistForwardMutationDetail = {
  schemaVersion: 1;
  actionId: string;
  occurredAt: string;
  settled: Promise<readonly TaskActionJournalChange[] | null>;
};

export type TaskChecklistForwardMutationReservation = {
  commit: (changes: readonly TaskActionJournalChange[]) => void;
  cancel: () => void;
};

export function reserveTaskChecklistForwardMutation(
  detail: Pick<TaskChecklistForwardMutationDetail, 'actionId' | 'occurredAt'>,
): TaskChecklistForwardMutationReservation {
  let settle: (changes: readonly TaskActionJournalChange[] | null) => void = () => undefined;
  const settled = new Promise<readonly TaskActionJournalChange[] | null>((resolve) => {
    settle = resolve;
  });
  let resolved = false;
  globalThis.dispatchEvent?.(new CustomEvent<TaskChecklistForwardMutationDetail>(
    TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
    { detail: { schemaVersion: 1, ...detail, settled } },
  ));
  return {
    commit(changes) {
      if (resolved) return;
      resolved = true;
      settle(changes);
    },
    cancel() {
      if (resolved) return;
      resolved = true;
      settle(null);
    },
  };
}
