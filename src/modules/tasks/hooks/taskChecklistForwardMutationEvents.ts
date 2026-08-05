export const TASK_CHECKLIST_FORWARD_MUTATION_EVENT =
  'bathos:task-checklist-forward-mutation';

export type TaskChecklistForwardMutationDetail = {
  schemaVersion: 1;
  actionId: string;
  occurredAt: string;
};

export function notifyTaskChecklistForwardMutation(
  detail: Omit<TaskChecklistForwardMutationDetail, 'schemaVersion'>,
) {
  globalThis.dispatchEvent?.(new CustomEvent<TaskChecklistForwardMutationDetail>(
    TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
    { detail: { schemaVersion: 1, ...detail } },
  ));
}
