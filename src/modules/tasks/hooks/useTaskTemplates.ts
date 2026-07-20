import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  parseTaskTemplate,
  parseTaskTemplateRevision,
  type TaskTemplateCaptureInput,
} from '@/modules/tasks/data/taskTemplateService';
import { taskCalendarDateInTimeZone } from '@/modules/tasks/domain/taskDates';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskProject,
  TaskTemplate,
  TaskTemplateRevision,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

export function useTaskTemplates(ownerId: string) {
  const { mode, planningTimeZone, templateService } = useTasksRuntime();
  const templatesQuery = useQuery<TaskTemplate>(
    `SELECT * FROM tasks_templates
     WHERE owner_id = ? AND archived_at IS NULL
     ORDER BY kind, name COLLATE NOCASE, id`,
    [ownerId],
  );
  const revisionsQuery = useQuery<TaskTemplateRevision>(
    `SELECT revision.*
     FROM tasks_template_revisions revision
     JOIN tasks_templates template
       ON template.id = revision.template_id
      AND template.owner_id = revision.owner_id
      AND template.current_revision = revision.revision
     WHERE revision.owner_id = ? AND template.archived_at IS NULL
     ORDER BY revision.template_id`,
    [ownerId],
  );
  const todosQuery = useQuery<TaskTodo>(
    `SELECT * FROM tasks_todos
     WHERE owner_id = ? AND disposition = 'present' AND lifecycle = 'open'
     ORDER BY title COLLATE NOCASE, id`,
    [ownerId],
  );
  const projectsQuery = useQuery<TaskProject>(
    `SELECT * FROM tasks_projects
     WHERE owner_id = ? AND disposition = 'present' AND lifecycle = 'open'
     ORDER BY title COLLATE NOCASE, id`,
    [ownerId],
  );
  const [optimisticTemplates, setOptimisticTemplates] = useState<Record<string, TaskTemplate | null>>({});
  const [optimisticRevisions, setOptimisticRevisions] = useState<Record<string, TaskTemplateRevision>>({});

  const queriedTemplates = useMemo(
    () => templatesQuery.data.map((template) => parseTaskTemplate(template)),
    [templatesQuery.data],
  );
  const queriedRevisions = useMemo(
    () => revisionsQuery.data.map((revision) => parseTaskTemplateRevision(revision)),
    [revisionsQuery.data],
  );

  useEffect(() => {
    setOptimisticTemplates((current) => clearCaughtUpTemplates(current, queriedTemplates));
  }, [queriedTemplates]);
  useEffect(() => {
    setOptimisticRevisions((current) => clearCaughtUpRevisions(current, queriedRevisions));
  }, [queriedRevisions]);

  const templates = useMemo(() => {
    const rows = new Map(queriedTemplates.map((template) => [template.id, template]));
    for (const [id, template] of Object.entries(optimisticTemplates)) {
      if (template === null) rows.delete(id);
      else rows.set(id, template);
    }
    return Array.from(rows.values()).sort((left, right) => (
      left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
    ));
  }, [optimisticTemplates, queriedTemplates]);

  const revisions = useMemo(() => {
    const rows = new Map(queriedRevisions.map((revision) => [revision.template_id, revision]));
    for (const [templateId, revision] of Object.entries(optimisticRevisions)) {
      rows.set(templateId, revision);
    }
    return rows;
  }, [optimisticRevisions, queriedRevisions]);

  const requireConnected = useCallback(() => {
    if (mode !== 'connected') {
      throw new Error('Template changes require connected task storage');
    }
  }, [mode]);

  const capture = useCallback(async (input: Omit<TaskTemplateCaptureInput, 'anchorDate'> & {
    anchorDate?: string;
  }) => {
    requireConnected();
    const result = await templateService.capture({
      ...input,
      anchorDate: input.anchorDate ?? taskCalendarDateInTimeZone(new Date(), planningTimeZone),
    });
    setOptimisticTemplates((current) => ({ ...current, [result.template.id]: result.template }));
    setOptimisticRevisions((current) => ({
      ...current,
      [result.template.id]: result.revision,
    }));
    return result;
  }, [planningTimeZone, requireConnected, templateService]);

  const archive = useCallback(async (template: TaskTemplate) => {
    requireConnected();
    const result = await templateService.archive(template.id, template.record_revision);
    if (result.outcome === 'conflict') {
      throw new Error('The template changed before it could be archived');
    }
    setOptimisticTemplates((current) => ({ ...current, [template.id]: null }));
    return result;
  }, [requireConnected, templateService]);

  const instantiate = useCallback(async (input: {
    templateId: string;
    templateRevision: number;
    anchorDate: string;
    targetAreaId?: string | null;
  }) => {
    requireConnected();
    return templateService.instantiate(input);
  }, [requireConnected, templateService]);

  return {
    templates,
    revisions,
    todos: todosQuery.data,
    projects: projectsQuery.data,
    mode,
    planningDate: taskCalendarDateInTimeZone(new Date(), planningTimeZone),
    loading: templatesQuery.isLoading
      || revisionsQuery.isLoading
      || todosQuery.isLoading
      || projectsQuery.isLoading,
    error: templatesQuery.error
      ?? revisionsQuery.error
      ?? todosQuery.error
      ?? projectsQuery.error,
    capture,
    archive,
    instantiate,
  };
}

export type TaskTemplatesModel = ReturnType<typeof useTaskTemplates>;

function clearCaughtUpTemplates(
  optimistic: Record<string, TaskTemplate | null>,
  queried: readonly TaskTemplate[],
): Record<string, TaskTemplate | null> {
  const next = { ...optimistic };
  for (const [id, row] of Object.entries(next)) {
    const remote = queried.find((template) => template.id === id);
    if ((row === null && !remote) || (row && remote?.client_mutation_id === row.client_mutation_id)) {
      delete next[id];
    }
  }
  return next;
}

function clearCaughtUpRevisions(
  optimistic: Record<string, TaskTemplateRevision>,
  queried: readonly TaskTemplateRevision[],
): Record<string, TaskTemplateRevision> {
  const next = { ...optimistic };
  for (const [templateId, row] of Object.entries(next)) {
    if (queried.some((remote) => (
      remote.template_id === templateId && remote.client_mutation_id === row.client_mutation_id
    ))) {
      delete next[templateId];
    }
  }
  return next;
}
