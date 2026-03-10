import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import { exerciseRoutinesQueryKey } from '@/modules/exercise/lib/queryKeys';
import type { ExerciseRoutine, ExerciseRoutineInput, ExerciseRoutineItem, ExerciseRoutineWithItems } from '@/modules/exercise/types/exercise';

function sortRoutines(routines: ExerciseRoutineWithItems[]): ExerciseRoutineWithItems[] {
  return [...routines].sort((left, right) => left.name.localeCompare(right.name));
}

export function useExerciseRoutines(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = exerciseRoutinesQueryKey(userId);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const routines = await supabaseRequest(async () =>
        await supabase
          .from('exercise_routines')
          .select('*')
          .eq('user_id', userId as string)
          .order('name', { ascending: true }),
      );

      const routineRows = (routines as ExerciseRoutine[]) ?? [];
      if (routineRows.length === 0) {
        return [] as ExerciseRoutineWithItems[];
      }

      const items = await supabaseRequest(async () =>
        await supabase
          .from('exercise_routine_items')
          .select('*')
          .in('routine_id', routineRows.map((routine) => routine.id))
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true }),
      );

      const itemsByRoutineId = new Map<string, ExerciseRoutineItem[]>();
      for (const item of (items as ExerciseRoutineItem[]) ?? []) {
        const current = itemsByRoutineId.get(item.routine_id) ?? [];
        current.push(item);
        itemsByRoutineId.set(item.routine_id, current);
      }

      return sortRoutines(routineRows.map((routine) => ({
        ...routine,
        items: itemsByRoutineId.get(routine.id) ?? [],
      })));
    },
  });

  const addRoutine = useCallback(async (input: ExerciseRoutineInput) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      const inserted = await supabaseRequest(async () =>
        await supabase
          .from('exercise_routines')
          .insert({
            user_id: userId,
            name: input.name,
          })
          .select('*')
          .single(),
      );

      if (input.exercise_definition_ids.length > 0) {
        await supabaseRequest(async () =>
          await supabase
            .from('exercise_routine_items')
            .insert(input.exercise_definition_ids.map((exerciseDefinitionId, index) => ({
              routine_id: (inserted as ExerciseRoutine).id,
              exercise_definition_id: exerciseDefinitionId,
              sort_order: index,
            }))),
        );
      }

      await queryClient.invalidateQueries({ queryKey });
      return inserted as ExerciseRoutine;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const updateRoutine = useCallback(async (id: string, input: ExerciseRoutineInput) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('exercise_routines')
          .update({
            name: input.name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId),
      );

      await supabaseRequest(async () =>
        await supabase
          .from('exercise_routine_items')
          .delete()
          .eq('routine_id', id),
      );

      if (input.exercise_definition_ids.length > 0) {
        await supabaseRequest(async () =>
          await supabase
            .from('exercise_routine_items')
            .insert(input.exercise_definition_ids.map((exerciseDefinitionId, index) => ({
              routine_id: id,
              exercise_definition_id: exerciseDefinitionId,
              sort_order: index,
            }))),
        );
      }

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const removeRoutine = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('exercise_routines')
          .delete()
          .eq('id', id)
          .eq('user_id', userId),
      );

      queryClient.setQueryData<ExerciseRoutineWithItems[]>(queryKey, (current) =>
        (current ?? []).filter((routine) => routine.id !== id),
      );
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    routines: data ?? [],
    loading: !!userId && isLoading,
    addRoutine,
    updateRoutine,
    removeRoutine,
  };
}
