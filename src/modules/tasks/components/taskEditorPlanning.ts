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
    normalizedPatch.today_section = null;
  }
  if (patch.start_date !== undefined && patch.start_date !== null && patch.start_date <= planningDate) {
    throw new Error("Start must be later than Today");
  }
  if (patch.start_date) normalizedPatch.today_section = null;
  else if (patch.today_section) normalizedPatch.start_date = null;
  return normalizedPatch;
}
