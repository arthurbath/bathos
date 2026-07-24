import type { AbstractPowerSyncDatabase } from '@powersync/web';

import type { TaskHierarchyRepository } from '@/modules/tasks/data/taskHierarchyRepository';
import type { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import type { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import type { TaskRepository } from '@/modules/tasks/data/taskRepository';
import {
  planTaskClipboardPaste,
  type TaskClipboardDestination,
  type TaskClipboardRecurrence,
  type TaskClipboardSnapshot,
} from '@/modules/tasks/domain/taskClipboard';
import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import type {
  TaskChecklistItem,
  TaskRecurrenceDefinition,
  TaskRecurrenceRevision,
  TaskReminder,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

type ClipboardDatabase = Pick<AbstractPowerSyncDatabase, 'getAll' | 'getOptional'>;

type ReconstructOptions = {
  destination: TaskClipboardDestination | 'source';
  connected: boolean;
  planningDate: string;
  planningTimeZone: string;
  atTop: boolean;
};

export class TaskClipboardService {
  constructor(
    private readonly database: ClipboardDatabase,
    private readonly repository: TaskRepository,
    private readonly hierarchyRepository: TaskHierarchyRepository,
    private readonly reminderService: TaskReminderService,
    private readonly recurrenceService: TaskRecurrenceService,
    private readonly ownerId: string,
  ) {}

  async snapshot(tasks: readonly TaskTodo[]): Promise<TaskClipboardSnapshot[]> {
    if (tasks.length === 0) return [];
    const ids = tasks.map(({ id }) => id);
    const placeholders = ids.map(() => '?').join(', ');
    const [projectedTasks, checklist, reminders] = await Promise.all([
      this.database.getAll<TaskTodo>(
        `SELECT * FROM tasks_todos
         WHERE owner_id = ? AND id IN (${placeholders})`,
        [this.ownerId, ...ids],
      ),
      this.database.getAll<TaskChecklistItem>(
        `SELECT * FROM tasks_checklist_items
         WHERE owner_id = ? AND task_id IN (${placeholders}) AND disposition = 'present'
         ORDER BY task_id, order_key, id`,
        [this.ownerId, ...ids],
      ),
      this.database.getAll<TaskReminder>(
        `SELECT * FROM tasks_reminders
         WHERE owner_id = ? AND task_id IN (${placeholders}) AND status = 'active'
         ORDER BY task_id, id`,
        [this.ownerId, ...ids],
      ),
    ]);
    const taskById = new Map(projectedTasks.map((task) => [task.id, task]));
    const orderedTasks = ids.map((id) => {
      const task = taskById.get(id);
      if (!task) throw new Error('A selected task is not fully projected');
      return task;
    });
    const checklistByTask = groupBy(checklist, ({ task_id }) => task_id);
    const reminderByTask = new Map(
      reminders.flatMap((reminder) => (
        reminder.task_id ? [[reminder.task_id, reminder] as const] : []
      )),
    );
    const recurrenceByTask = new Map<string, TaskClipboardRecurrence | null>();
    await Promise.all(orderedTasks.map(async (task) => {
      recurrenceByTask.set(task.id, await this.loadRecurrence(task));
    }));

    return orderedTasks.map((task) => {
      const reminder = reminderByTask.get(task.id) ?? null;
      return {
        title: task.title,
        notes: task.notes,
        primaryLink: task.primary_link,
        destination: task.destination,
        todaySection: task.today_section,
        startDate: task.start_date,
        deadline: task.deadline,
        actionability: task.actionability,
        areaId: task.area_id,
        projectId: task.project_id,
        checklist: (checklistByTask.get(task.id) ?? []).map((item) => ({
          title: item.title,
          completed: item.completed,
          orderKey: item.order_key,
        })),
        reminder: reminder === null ? null : {
          localTime: reminder.local_time.slice(0, 5),
          timeZone: reminder.time_zone,
          ambiguityChoice: reminder.ambiguity_choice,
        },
        recurrence: recurrenceByTask.get(task.id) ?? null,
      };
    });
  }

  async reconstruct(
    snapshots: readonly TaskClipboardSnapshot[],
    options: ReconstructOptions,
  ): Promise<TaskTodo[]> {
    if (snapshots.length === 0) return [];
    const plans = snapshots.map((snapshot) => {
      const planned = options.destination === 'source'
        ? { ...snapshot }
        : planTaskClipboardPaste(snapshot, options.destination, {
          planningTimeZone: options.planningTimeZone,
        });
      if (planned.startDate !== null && planned.startDate <= options.planningDate) {
        return {
          ...planned,
          startDate: null,
        };
      }
      return planned;
    });
    if (
      !options.connected
      && plans.some(({ reminder, recurrence }) => reminder !== null || recurrence !== null)
    ) {
      throw new Error('Reminder and recurrence copies require connected task storage');
    }

    let nextPlanningKey: string | null = null;
    let nextHierarchyKey: string | null = null;
    if (options.atTop) {
      [nextPlanningKey, nextHierarchyKey] = await Promise.all([
        this.firstPlanningOrderKey(plans[0]),
        this.firstHierarchyOrderKey(plans[0]),
      ]);
    }

    const created: TaskTodo[] = [];
    try {
      for (let index = plans.length - 1; index >= 0; index -= 1) {
        const plan = plans[index];
        const orderKey = options.atTop
          ? generateTaskOrderKey(null, nextPlanningKey)
          : undefined;
        const hierarchyOrderKey = options.atTop && (plan.areaId !== null || plan.projectId !== null)
          ? generateTaskOrderKey(null, nextHierarchyKey)
          : undefined;
        const task = await this.repository.createTask({
          ownerId: this.ownerId,
          title: plan.title,
          notes: plan.notes,
          primaryLink: plan.primaryLink,
          destination: plan.destination,
          todaySection: plan.todaySection,
          startDate: plan.startDate,
          deadline: plan.deadline,
          actionability: plan.actionability,
          areaId: plan.areaId,
          projectId: plan.projectId,
          ...(orderKey ? { orderKey } : {}),
          ...(hierarchyOrderKey ? { hierarchyOrderKey } : {}),
        });
        created.unshift(task);
        if (options.atTop) {
          nextPlanningKey = task.order_key;
          if (task.hierarchy_order_key !== null) nextHierarchyKey = task.hierarchy_order_key;
        }
        await this.reconstructChildren(task, plan);
      }
      return created;
    } catch (error) {
      await Promise.allSettled(created.map((task) => (
        this.repository.transitionTask(this.ownerId, task.id, 'delete')
      )));
      throw error;
    }
  }

  private async reconstructChildren(
    task: TaskTodo,
    snapshot: TaskClipboardSnapshot,
  ): Promise<void> {
    for (const item of snapshot.checklist) {
      const created = await this.hierarchyRepository.createChecklistItem({
        ownerId: this.ownerId,
        taskId: task.id,
        title: item.title,
        orderKey: item.orderKey,
      });
      if (item.completed) {
        await this.hierarchyRepository.completeChecklistItem(
          this.ownerId,
          created.id,
          true,
        );
      }
    }
    if (snapshot.reminder !== null) {
      const result = await this.reminderService.save({
        rootType: 'todo',
        rootId: task.id,
        localTime: snapshot.reminder.localTime,
        timeZone: snapshot.reminder.timeZone,
        ambiguityChoice: snapshot.reminder.ambiguityChoice,
      });
      if (result.outcome === 'conflict') throw new Error('Reminder copy conflicted');
    }
    if (snapshot.recurrence !== null) {
      const recurrence = snapshot.recurrence;
      const result = await this.recurrenceService.save({
        name: recurrence.name,
        templateId: recurrence.templateId,
        templateRevision: recurrence.templateRevision,
        ruleMode: recurrence.ruleMode,
        frequency: recurrence.frequency,
        intervalCount: recurrence.intervalCount,
        startDate: recurrence.startDate,
        planningTimeZone: recurrence.planningTimeZone,
        missedPolicy: recurrence.missedPolicy,
        catchUpLimit: recurrence.catchUpLimit,
        targetAreaId: recurrence.targetAreaId,
      });
      if (result.outcome === 'conflict') throw new Error('Recurrence copy conflicted');
      if (recurrence.status !== 'active') {
        const statusResult = await this.recurrenceService.setStatus(
          result.definition,
          recurrence.status,
        );
        if (statusResult.outcome === 'conflict') {
          throw new Error('Recurrence status copy conflicted');
        }
      }
    }
  }

  private async loadRecurrence(task: TaskTodo): Promise<TaskClipboardRecurrence | null> {
    if (task.recurrence_definition_id === null || task.recurrence_revision === null) {
      return null;
    }
    const [definition, revision] = await Promise.all([
      this.database.getOptional<TaskRecurrenceDefinition>(
        `SELECT * FROM tasks_recurrence_definitions
         WHERE owner_id = ? AND id = ?`,
        [this.ownerId, task.recurrence_definition_id],
      ),
      this.database.getOptional<TaskRecurrenceRevision>(
        `SELECT * FROM tasks_recurrence_revisions
         WHERE owner_id = ? AND recurrence_id = ? AND revision = ?`,
        [this.ownerId, task.recurrence_definition_id, task.recurrence_revision],
      ),
    ]);
    if (!definition || !revision) {
      throw new Error('The task recurrence is not fully projected');
    }
    return {
      name: definition.name,
      status: definition.status,
      templateId: revision.template_id,
      templateRevision: revision.template_revision,
      ruleMode: revision.rule_mode,
      frequency: revision.frequency,
      intervalCount: revision.interval_count,
      startDate: revision.start_date,
      planningTimeZone: revision.planning_timezone,
      missedPolicy: revision.missed_policy,
      catchUpLimit: revision.catch_up_limit,
      targetAreaId: revision.target_area_id,
    };
  }

  private async firstPlanningOrderKey(
    plan: TaskClipboardSnapshot,
  ): Promise<string | null> {
    const row = await this.database.getOptional<{ order_key: string }>(
      `SELECT order_key FROM tasks_todos
       WHERE owner_id = ? AND destination = ? AND today_section IS ?
         AND lifecycle = 'open' AND disposition = 'present'
       ORDER BY order_key, id LIMIT 1`,
      [this.ownerId, plan.destination, plan.todaySection],
    );
    return row?.order_key ?? null;
  }

  private async firstHierarchyOrderKey(
    plan: TaskClipboardSnapshot,
  ): Promise<string | null> {
    if (plan.areaId === null && plan.projectId === null) return null;
    const row = await this.database.getOptional<{ hierarchy_order_key: string }>(
      `SELECT hierarchy_order_key FROM tasks_todos
       WHERE owner_id = ? AND area_id IS ? AND project_id IS ?
         AND lifecycle = 'open' AND disposition = 'present'
       ORDER BY hierarchy_order_key, id LIMIT 1`,
      [this.ownerId, plan.areaId, plan.projectId],
    );
    return row?.hierarchy_order_key ?? null;
  }
}

function groupBy<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}
