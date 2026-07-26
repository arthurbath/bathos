import type { LucideIcon } from 'lucide-react';

import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import type { TaskTodaySection } from '@/modules/tasks/types/tasks';

export type TaskHorizonPresentation = {
  id: TaskTodaySection;
  label: string;
  icon: LucideIcon;
  colorClass: string;
};

export const taskHorizonPresentations: ReadonlyArray<TaskHorizonPresentation> = [
  {
    id: 'inbox',
    label: 'Inbox',
    icon: TASK_ICONS.Inbox,
    colorClass: 'text-task-horizon-inbox',
  },
  {
    id: 'now',
    label: 'Now',
    icon: TASK_ICONS.Now,
    colorClass: 'text-task-horizon-now',
  },
  {
    id: 'next',
    label: 'Next',
    icon: TASK_ICONS.Next,
    colorClass: 'text-task-horizon-next',
  },
  {
    id: 'later',
    label: 'Later',
    icon: TASK_ICONS.Later,
    colorClass: 'text-task-horizon-later',
  },
];

export function getTaskHorizonPresentation(
  horizon: TaskTodaySection,
): TaskHorizonPresentation {
  return taskHorizonPresentations.find(({ id }) => id === horizon)
    ?? taskHorizonPresentations[0];
}
