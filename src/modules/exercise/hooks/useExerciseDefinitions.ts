import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import { exerciseDefinitionsQueryKey, exerciseRoutinesQueryKey } from '@/modules/exercise/lib/queryKeys';
import type { ExerciseDefinition, ExerciseDefinitionInput } from '@/modules/exercise/types/exercise';

function sortDefinitions(definitions: ExerciseDefinition[]): ExerciseDefinition[] {
  return [...definitions].sort((left, right) => left.name.localeCompare(right.name));
}

export function useExerciseDefinitions(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = exerciseDefinitionsQueryKey(userId);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const rows = await supabaseRequest(async () =>
        await supabase
          .from('exercise_definitions')
          .select('*')
          .eq('user_id', userId as string)
          .order('name', { ascending: true }),
      );
      return (rows as ExerciseDefinition[]) ?? [];
    },
  });

  const addDefinition = useCallback(async (input: ExerciseDefinitionInput, id?: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      const inserted = await supabaseRequest(async () =>
        await supabase
          .from('exercise_definitions')
          .insert({
            ...(id ? { id } : {}),
            ...input,
            user_id: userId,
          })
          .select('*')
          .single(),
      );

      queryClient.setQueryData<ExerciseDefinition[]>(queryKey, (current) =>
        sortDefinitions([...(current ?? []), inserted as ExerciseDefinition]),
      );

      return inserted as ExerciseDefinition;

    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const updateDefinition = useCallback(async (id: string, updates: ExerciseDefinitionInput) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      const updated = await supabaseRequest(async () =>
        await supabase
          .from('exercise_definitions')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single(),
      );

      queryClient.setQueryData<ExerciseDefinition[]>(queryKey, (current) =>
        sortDefinitions((current ?? []).map((definition) => (
          definition.id === id ? (updated as ExerciseDefinition) : definition
        ))),
      );

      return updated as ExerciseDefinition;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const removeDefinition = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('exercise_definitions')
          .delete()
          .eq('id', id)
          .eq('user_id', userId),
      );

      queryClient.setQueryData<ExerciseDefinition[]>(queryKey, (current) =>
        (current ?? []).filter((definition) => definition.id !== id),
      );
      await queryClient.invalidateQueries({ queryKey: exerciseRoutinesQueryKey(userId) });
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    definitions: data ?? [],
    loading: !!userId && isLoading,
    addDefinition,
    updateDefinition,
    removeDefinition,
  };
}
