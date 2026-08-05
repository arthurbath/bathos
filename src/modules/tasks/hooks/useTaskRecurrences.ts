import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  parseTaskRecurrenceDefinition,
  parseTaskRecurrenceOccurrence,
  parseTaskRecurrenceRevision,
  type TaskRecurrenceCreateFromTaskInput,
  type TaskRecurrenceEditInput,
} from '@/modules/tasks/data/taskRecurrenceService';
import {
  addTaskCalendarDays,
  taskCalendarDateInTimeZone,
} from '@/modules/tasks/domain/taskDates';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';

type OpenTaskRecurrenceOccurrence = {
  recurrence_id: string;
  root_id: string;
  scheduled_date: string;
  destination: string;
  today_section: string | null;
  start_date: string | null;
  deadline: string | null;
};

export function useTaskRecurrences(ownerId: string) {
  const { mode, planningTimeZone, recurrenceService } = useTasksRuntime();
  const definitionsQuery = useQuery<TaskRecurrenceDefinition>(
    `SELECT * FROM tasks_recurrence_definitions
     WHERE owner_id = ? AND status <> 'archived'
     ORDER BY name COLLATE NOCASE, id`,
    [ownerId],
  );
  const revisionsQuery = useQuery<TaskRecurrenceRevision>(
    `SELECT revision.*
     FROM tasks_recurrence_revisions revision
     JOIN tasks_recurrence_definitions definition
       ON definition.id = revision.recurrence_id
      AND definition.owner_id = revision.owner_id
      AND definition.current_revision = revision.revision
     WHERE revision.owner_id = ? AND definition.status <> 'archived'
     ORDER BY revision.recurrence_id`,
    [ownerId],
  );
  const occurrencesQuery = useQuery<TaskRecurrenceOccurrence>(
    `SELECT * FROM tasks_recurrence_occurrences
     WHERE owner_id = ?
     ORDER BY scheduled_date DESC, generated_at DESC, id DESC`,
    [ownerId],
  );
  const openOccurrencesQuery = useQuery<OpenTaskRecurrenceOccurrence>(
    `SELECT occurrence.recurrence_id,
            occurrence.root_id,
            occurrence.scheduled_date,
            task.destination,
            task.today_section,
            task.start_date,
            task.deadline
     FROM tasks_recurrence_occurrences occurrence
     JOIN tasks_todos task
       ON task.id = occurrence.root_id
      AND task.owner_id = occurrence.owner_id
     WHERE occurrence.owner_id = ?
       AND task.lifecycle = 'open'
       AND task.disposition = 'present'
       AND task.recurrence_superseded_at IS NULL
     ORDER BY occurrence.generated_at DESC, occurrence.id DESC`,
    [ownerId],
  );
  const [optimisticDefinitions, setOptimisticDefinitions] = useState<
    Record<string, TaskRecurrenceDefinition | null>
  >({});
  const [optimisticRevisions, setOptimisticRevisions] = useState<
    Record<string, TaskRecurrenceRevision>
  >({});
  const [evaluationFailures, setEvaluationFailures] = useState<Set<string>>(
    () => new Set(),
  );
  const evaluationRequests = useRef(new Set<string>());
  const planningDate = taskCalendarDateInTimeZone(planningTimeZone);

  const queriedDefinitions = useMemo(
    () => definitionsQuery.data.map((definition) => (
      parseTaskRecurrenceDefinition(definition)
    )),
    [definitionsQuery.data],
  );
  const queriedRevisions = useMemo(
    () => revisionsQuery.data.flatMap((revision) => {
      try {
        return [parseTaskRecurrenceRevision(revision)];
      } catch (error) {
        console.error('Tasks skipped an invalid synchronized recurrence revision', error);
        return [];
      }
    }),
    [revisionsQuery.data],
  );
  const occurrences = useMemo(
    () => occurrencesQuery.data.map((occurrence) => (
      parseTaskRecurrenceOccurrence(occurrence)
    )),
    [occurrencesQuery.data],
  );
  const openOccurrenceByDefinitionId = useMemo(
    () => {
      const rows = new Map<string, OpenTaskRecurrenceOccurrence>();
      for (const occurrence of openOccurrencesQuery.data) {
        if (!rows.has(occurrence.recurrence_id)) {
          rows.set(occurrence.recurrence_id, occurrence);
        }
      }
      return rows;
    },
    [openOccurrencesQuery.data],
  );
  const openOccurrenceDefinitionIds = useMemo(
    () => new Set(openOccurrenceByDefinitionId.keys()),
    [openOccurrenceByDefinitionId],
  );

  useEffect(() => {
    setOptimisticDefinitions((current) => {
      const next = { ...current };
      for (const [id, row] of Object.entries(next)) {
        const remote = queriedDefinitions.find((definition) => definition.id === id);
        if ((row === null && !remote) || (row && remote?.client_mutation_id === row.client_mutation_id)) {
          delete next[id];
        }
      }
      return next;
    });
  }, [queriedDefinitions]);
  useEffect(() => {
    setOptimisticRevisions((current) => {
      const next = { ...current };
      for (const [id, row] of Object.entries(next)) {
        if (queriedRevisions.some((remote) => (
          remote.recurrence_id === id && remote.client_mutation_id === row.client_mutation_id
        ))) {
          delete next[id];
        }
      }
      return next;
    });
  }, [queriedRevisions]);

  const definitions = useMemo(() => {
    const rows = new Map(queriedDefinitions.map((definition) => [definition.id, definition]));
    for (const [id, definition] of Object.entries(optimisticDefinitions)) {
      if (definition === null) rows.delete(id);
      else rows.set(id, definition);
    }
    return Array.from(rows.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [optimisticDefinitions, queriedDefinitions]);
  const revisions = useMemo(() => {
    const rows = new Map(queriedRevisions.map((revision) => [revision.recurrence_id, revision]));
    for (const [id, revision] of Object.entries(optimisticRevisions)) rows.set(id, revision);
    return rows;
  }, [optimisticRevisions, queriedRevisions]);

  const clearEvaluationFailure = useCallback((recurrenceId: string) => {
    setEvaluationFailures((current) => {
      if (!current.has(recurrenceId)) return current;
      const next = new Set(current);
      next.delete(recurrenceId);
      return next;
    });
  }, []);

  const recordEvaluationFailure = useCallback((recurrenceId: string) => {
    setEvaluationFailures((current) => {
      if (current.has(recurrenceId)) return current;
      const next = new Set(current);
      next.add(recurrenceId);
      return next;
    });
  }, []);

  const runEvaluation = useCallback(async (recurrenceId: string) => {
    const throughDate = planningDate;
    const key = `${recurrenceId}:${throughDate}`;
    evaluationRequests.current.add(key);
    try {
      const result = await recurrenceService.evaluate(recurrenceId, throughDate);
      setOptimisticDefinitions((current) => ({
        ...current,
        [recurrenceId]: result.definition,
      }));
      clearEvaluationFailure(recurrenceId);
      return result;
    } catch (error) {
      recordEvaluationFailure(recurrenceId);
      throw error;
    }
  }, [
    clearEvaluationFailure,
    planningDate,
    recordEvaluationFailure,
    recurrenceService,
  ]);

  const evaluate = useCallback(async (definition: TaskRecurrenceDefinition) => {
    if (mode !== 'connected') throw new Error('Recurrence evaluation requires connected task storage');
    return runEvaluation(definition.id);
  }, [mode, runEvaluation]);

  useEffect(() => {
    if (mode !== 'connected') return;
    for (const definition of definitions) {
      const revision = revisions.get(definition.id);
      const throughDate = planningDate;
      const recurrenceOffset = revision?.deadline_after_start_days ?? revision?.deadline_offset_days;
      const spawnDate = definition.next_occurrence_date
        && revision?.date_basis === 'deadline'
        && recurrenceOffset
        ? addTaskCalendarDays(
            definition.next_occurrence_date,
            -recurrenceOffset,
          )
        : definition.next_occurrence_date;
      const key = `${definition.id}:${throughDate}`;
      if (
        definition.status !== 'active'
        || spawnDate === null
        || spawnDate > throughDate
        || evaluationRequests.current.has(key)
      ) continue;
      evaluationRequests.current.add(key);
      void runEvaluation(definition.id).catch(() => undefined);
    }
  }, [
    definitions,
    mode,
    planningDate,
    revisions,
    runEvaluation,
  ]);

  const createFromTask = useCallback(async (
    input: TaskRecurrenceCreateFromTaskInput,
  ) => {
    if (mode !== 'connected') {
      throw new Error('Recurrence changes require connected task storage');
    }
    const result = await recurrenceService.createFromTask(input);
    setOptimisticDefinitions((current) => ({
      ...current,
      [result.definition.id]: result.definition,
    }));
    if (result.revision) {
      setOptimisticRevisions((current) => ({
        ...current,
        [result.definition.id]: result.revision!,
      }));
    }
    clearEvaluationFailure(result.definition.id);
    if (input.ruleMode === 'calendar' && input.scheduleDate <= planningDate) {
      await runEvaluation(result.definition.id).catch(() => undefined);
    }
    return result;
  }, [
    clearEvaluationFailure,
    mode,
    planningDate,
    recurrenceService,
    runEvaluation,
  ]);

  const edit = useCallback(async (input: TaskRecurrenceEditInput) => {
    if (mode !== 'connected') {
      throw new Error('Recurrence changes require connected task storage');
    }
    const result = await recurrenceService.edit(input);
    if (result.outcome === 'conflict') {
      throw new Error('The recurrence changed before it could be saved');
    }
    setOptimisticDefinitions((current) => ({
      ...current,
      [result.definition.id]: result.definition,
    }));
    if (result.revision) {
      setOptimisticRevisions((current) => ({
        ...current,
        [result.definition.id]: result.revision!,
      }));
    }
    clearEvaluationFailure(result.definition.id);
    if (input.ruleMode === 'calendar' && result.definition.status === 'active') {
      await runEvaluation(result.definition.id).catch(() => undefined);
    }
    return result;
  }, [clearEvaluationFailure, mode, recurrenceService, runEvaluation]);

  const setStatus = useCallback(async (
    definition: TaskRecurrenceDefinition,
    status: 'active' | 'paused' | 'archived',
  ) => {
    if (mode !== 'connected') throw new Error('Recurrence changes require connected task storage');
    if (status === 'archived') {
      setOptimisticDefinitions((current) => ({ ...current, [definition.id]: null }));
    }
    try {
      const result = await recurrenceService.setStatus(definition, status);
      if (result.outcome === 'conflict') {
        throw new Error('The recurrence changed before its status could be updated');
      }
      setOptimisticDefinitions((current) => ({
        ...current,
        [definition.id]: status === 'archived' ? null : result.definition,
      }));
      clearEvaluationFailure(definition.id);
      if (status === 'active') {
        await runEvaluation(definition.id).catch(() => undefined);
      }
      return result;
    } catch (error) {
      if (status === 'archived') {
        setOptimisticDefinitions((current) => ({ ...current, [definition.id]: definition }));
      }
      throw error;
    }
  }, [clearEvaluationFailure, mode, recurrenceService, runEvaluation]);

  const reorderProjection = useCallback(async (
    definition: TaskRecurrenceDefinition,
    upcomingOrderKey: string,
  ) => {
    if (mode !== 'connected') {
      throw new Error('Recurrence reordering requires connected task storage');
    }
    const optimistic = {
      ...definition,
      upcoming_order_key: upcomingOrderKey,
    };
    setOptimisticDefinitions((current) => ({ ...current, [definition.id]: optimistic }));
    let rollbackDefinition = definition;
    try {
      let result = await recurrenceService.reorderProjection(definition, upcomingOrderKey);
      if (result.outcome === 'conflict') {
        rollbackDefinition = result.definition;
        setOptimisticDefinitions((current) => ({
          ...current,
          [definition.id]: {
            ...result.definition,
            upcoming_order_key: upcomingOrderKey,
          },
        }));
        result = await recurrenceService.reorderProjection(
          result.definition,
          upcomingOrderKey,
        );
      }
      if (result.outcome === 'conflict') {
        rollbackDefinition = result.definition;
        throw new Error('The recurrence changed again before its position could be updated');
      }
      setOptimisticDefinitions((current) => ({
        ...current,
        [definition.id]: result.definition,
      }));
      return result;
    } catch (error) {
      setOptimisticDefinitions((current) => ({
        ...current,
        [definition.id]: rollbackDefinition,
      }));
      throw error;
    }
  }, [mode, recurrenceService]);

  return {
    definitions,
    revisions,
    occurrences,
    openOccurrenceDefinitionIds,
    openOccurrenceByDefinitionId,
    datedPrototypes: definitions.flatMap((definition) => {
      const revision = revisions.get(definition.id);
      if (
        definition.status !== 'active'
        || revision === undefined
        || definition.next_occurrence_date === null
      ) return [];

      const recurrenceOffset = revision.deadline_after_start_days ?? revision.deadline_offset_days;
      const scheduledDate = revision.date_basis === 'deadline' && recurrenceOffset
        ? addTaskCalendarDays(
            definition.next_occurrence_date,
            -recurrenceOffset,
          )
        : definition.next_occurrence_date;
      return scheduledDate > planningDate
        ? [{ definition, revision, scheduledDate }]
        : [];
    }),
    evaluationFailures,
    planningDate,
    mode,
    loading: definitionsQuery.isLoading
      || revisionsQuery.isLoading
      || occurrencesQuery.isLoading
      || openOccurrencesQuery.isLoading,
    error: definitionsQuery.error
      ?? revisionsQuery.error
      ?? occurrencesQuery.error
      ?? openOccurrencesQuery.error,
    createFromTask,
    edit,
    setStatus,
    reorderProjection,
    evaluate,
  };
}

export type TaskRecurrencesModel = ReturnType<typeof useTaskRecurrences>;
