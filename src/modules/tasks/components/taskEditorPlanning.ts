import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export function normalizeTaskEditorPlanningPatch(
  task: TaskTodo,
  patch: EditableTaskPatch,
  planningDate: string,
): EditableTaskPatch {
  const normalizedPatch: EditableTaskPatch = { ...patch };
  const activatesSomeday = task.destination === 'someday'
    && patch.start_date !== undefined
    && patch.start_date !== null;
  if (activatesSomeday) {
    normalizedPatch.destination = 'anytime';
    normalizedPatch.today_section = patch.today_section ?? 'next';
  }
  if (patch.start_date !== undefined && patch.start_date !== null && patch.start_date <= planningDate) {
    throw new Error('Start Date must be later than today');
  }
  if (
    patch.start_date
    && patch.today_section === undefined
    && task.today_section === null
  ) {
    normalizedPatch.today_section = 'next';
  }
  return normalizedPatch;
}
