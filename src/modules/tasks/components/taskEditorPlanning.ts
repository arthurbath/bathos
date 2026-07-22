import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export function normalizeTaskEditorPlanningPatch(
  task: TaskTodo,
  patch: EditableTaskPatch,
  _planningDate: string,
): EditableTaskPatch {
  const normalizedPatch: EditableTaskPatch = { ...patch };
  if (task.destination === 'someday'
    && patch.start_date !== undefined
    && patch.start_date !== null) {
    normalizedPatch.destination = 'anytime';
    normalizedPatch.today_section = patch.today_section ?? 'none';
  }
  return normalizedPatch;
}
