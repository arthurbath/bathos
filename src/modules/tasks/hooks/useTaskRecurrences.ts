import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  parseTaskRecurrenceDefinition,
  parseTaskRecurrenceOccurrence,
  parseTaskRecurrenceRevision,
  type TaskRecurrenceSaveInput,
} from '@/modules/tasks/data/taskRecurrenceService';
import { taskCalendarDateInTimeZone } from '@/modules/tasks/domain/taskDates';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';

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
  const [optimisticDefinitions, setOptimisticDefinitions] = useState<
    Record<string, TaskRecurrenceDefinition | null>
  >({});
  const [optimisticRevisions, setOptimisticRevisions] = useState<
    Record<string, TaskRecurrenceRevision>
  >({});
  const evaluationRequests = useRef(new Set<string>());
  const planningDate = taskCalendarDateInTimeZone(new Date(), planningTimeZone);

  const queriedDefinitions = useMemo(
    () => definitionsQuery.data.map((definition) => (
      parseTaskRecurrenceDefinition(definition)
    )),
    [definitionsQuery.data],
  );
  const queriedRevisions = useMemo(
    () => revisionsQuery.data.map((revision) => parseTaskRecurrenceRevision(revision)),
    [revisionsQuery.data],
  );
  const occurrences = useMemo(
    () => occurrencesQuery.data.map((occurrence) => (
      parseTaskRecurrenceOccurrence(occurrence)
    )),
    [occurrencesQuery.data],
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

  const evaluate = useCallback(async (definition: TaskRecurrenceDefinition) => {
    if (mode !== 'connected') throw new Error('Recurrence evaluation requires connected task storage');
    const result = await recurrenceService.evaluate(definition.id, planningDate);
    setOptimisticDefinitions((current) => ({
      ...current,
      [definition.id]: result.definition,
    }));
    return result;
  }, [mode, planningDate, recurrenceService]);

  useEffect(() => {
    if (mode !== 'connected') return;
    for (const definition of definitions) {
      const key = `${definition.id}:${planningDate}`;
      if (
        definition.status !== 'active'
        || definition.evaluated_through_date >= planningDate
        || evaluationRequests.current.has(key)
      ) continue;
      evaluationRequests.current.add(key);
      void recurrenceService.evaluate(definition.id, planningDate).then((result) => {
        setOptimisticDefinitions((current) => ({
          ...current,
          [definition.id]: result.definition,
        }));
      }).catch(() => {
        evaluationRequests.current.delete(key);
      });
    }
  }, [definitions, mode, planningDate, recurrenceService]);

  const save = useCallback(async (input: Omit<
    TaskRecurrenceSaveInput,
    'planningTimeZone'
  >) => {
    if (mode !== 'connected') throw new Error('Recurrence changes require connected task storage');
    const result = await recurrenceService.save({ ...input, planningTimeZone });
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
    if (
      result.definition.status === 'active'
      && input.startDate <= planningDate
    ) {
      const evaluation = await recurrenceService.evaluate(result.definition.id, planningDate);
      setOptimisticDefinitions((current) => ({
        ...current,
        [result.definition.id]: evaluation.definition,
      }));
    }
    return result;
  }, [mode, planningDate, planningTimeZone, recurrenceService]);

  const setStatus = useCallback(async (
    definition: TaskRecurrenceDefinition,
    status: 'active' | 'paused' | 'archived',
  ) => {
    if (mode !== 'connected') throw new Error('Recurrence changes require connected task storage');
    const result = await recurrenceService.setStatus(definition, status);
    if (result.outcome === 'conflict') {
      throw new Error('The recurrence changed before its status could be updated');
    }
    setOptimisticDefinitions((current) => ({
      ...current,
      [definition.id]: status === 'archived' ? null : result.definition,
    }));
    if (status === 'active') {
      const evaluation = await recurrenceService.evaluate(definition.id, planningDate);
      setOptimisticDefinitions((current) => ({
        ...current,
        [definition.id]: evaluation.definition,
      }));
    }
    return result;
  }, [mode, planningDate, recurrenceService]);

  return {
    definitions,
    revisions,
    occurrences,
    planningDate,
    mode,
    loading: definitionsQuery.isLoading || revisionsQuery.isLoading || occurrencesQuery.isLoading,
    error: definitionsQuery.error ?? revisionsQuery.error ?? occurrencesQuery.error,
    save,
    setStatus,
    evaluate,
  };
}

export type TaskRecurrencesModel = ReturnType<typeof useTaskRecurrences>;
