import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import type {
  Snake,
  SnakeGrowthExpectationRange,
  SnakeInput,
  SnakeUpdate,
  SnakeWeightRecord,
  SnakeWeightRecordInput,
  SnakeWeightRecordUpdate,
} from '@/modules/snake/types/snake';

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function normalizeSnakeInput(input: SnakeInput): SnakeInput {
  return {
    name: input.name.trim(),
    birthday: input.birthday,
    species: input.species.trim() || 'Ball Python',
    growth_profile: input.growth_profile.trim() || 'ball_python',
    morph: emptyToNull(input.morph),
    sex: input.sex,
    notes: emptyToNull(input.notes),
    ...(typeof input.is_active === 'boolean' ? { is_active: input.is_active } : {}),
  };
}

function snakeDataQueryKey(householdId: string | null | undefined) {
  return ['snake', 'data', householdId] as const;
}

function snakeWeightRecordsQueryKey(householdId: string | null | undefined, snakeId: string | null | undefined) {
  return ['snake', 'weight-records', householdId, snakeId] as const;
}

export function useSnakeData(householdId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = snakeDataQueryKey(householdId);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!householdId,
    queryFn: async () => {
      const [snakes, expectationRanges] = await Promise.all([
        supabaseRequest(async () =>
          await supabase
            .from('snake_snakes')
            .select('*')
            .eq('household_id', householdId as string)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
        ),
        supabaseRequest(async () =>
          await supabase
            .from('snake_growth_expectation_ranges')
            .select('*')
            .order('profile', { ascending: true })
            .order('sort_order', { ascending: true }),
        ),
      ]);

      return {
        snakes: (snakes as Snake[]) ?? [],
        expectationRanges: (expectationRanges as SnakeGrowthExpectationRange[]) ?? [],
      };
    },
  });

  const addSnake = useCallback(async (input: SnakeInput, id?: string) => {
    if (!householdId) throw new Error('No household selected.');

    const normalized = normalizeSnakeInput(input);

    try {
      const currentCount = data?.snakes.length ?? 0;
      await supabaseRequest(async () =>
        await supabase
          .from('snake_snakes')
          .insert({
            ...(id ? { id } : {}),
            household_id: householdId,
            ...normalized,
            sort_order: currentCount + 1,
            is_active: normalized.is_active ?? currentCount === 0,
          }),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [data?.snakes.length, householdId, refetch]);

  const updateSnake = useCallback(async (snakeId: string, updates: SnakeUpdate) => {
    if (!householdId) throw new Error('No household selected.');

    const normalizedUpdates = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, 'name') && typeof updates.name === 'string'
        ? { name: updates.name.trim() }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'species') && typeof updates.species === 'string'
        ? { species: updates.species.trim() || 'Ball Python' }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'growth_profile') && typeof updates.growth_profile === 'string'
        ? { growth_profile: updates.growth_profile.trim() || 'ball_python' }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'morph') ? { morph: emptyToNull(updates.morph) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'notes') ? { notes: emptyToNull(updates.notes) } : {}),
      updated_at: new Date().toISOString(),
    };

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('snake_snakes')
          .update(normalizedUpdates)
          .eq('id', snakeId)
          .eq('household_id', householdId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [householdId, refetch]);

  const removeSnake = useCallback(async (snakeId: string) => {
    if (!householdId) throw new Error('No household selected.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('snake_snakes')
          .delete()
          .eq('id', snakeId)
          .eq('household_id', householdId),
      );
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['snake', 'weight-records', householdId] });
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [householdId, queryClient, refetch]);

  const snakes = useMemo(() => data?.snakes ?? [], [data?.snakes]);
  const activeSnake = useMemo(() => snakes.find((snake) => snake.is_active) ?? snakes[0] ?? null, [snakes]);
  const expectationRanges = useMemo(() => data?.expectationRanges ?? [], [data?.expectationRanges]);

  return {
    snakes,
    activeSnake,
    expectationRanges,
    loading: !!householdId && isLoading,
    addSnake,
    updateSnake,
    removeSnake,
    refetch,
  };
}

export function useSnakeWeightRecords(
  householdId: string | null | undefined,
  snakeId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey = snakeWeightRecordsQueryKey(householdId, snakeId);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!householdId && !!snakeId,
    queryFn: async () => {
      const rows = await supabaseRequest(async () =>
        await supabase
          .from('snake_weight_records')
          .select('*')
          .eq('household_id', householdId as string)
          .eq('snake_id', snakeId as string)
          .order('recorded_on', { ascending: false })
          .order('created_at', { ascending: false }),
      );

      return (rows as SnakeWeightRecord[]) ?? [];
    },
  });

  const addWeightRecord = useCallback(async (input: SnakeWeightRecordInput, id?: string) => {
    if (!householdId || !snakeId) throw new Error('No snake selected.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('snake_weight_records')
          .insert({
            ...(id ? { id } : {}),
            household_id: householdId,
            snake_id: snakeId,
            recorded_on: input.recorded_on,
            weight_grams: input.weight_grams,
          }),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [householdId, refetch, snakeId]);

  const updateWeightRecord = useCallback(async (recordId: string, updates: SnakeWeightRecordUpdate) => {
    if (!householdId || !snakeId) throw new Error('No snake selected.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('snake_weight_records')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recordId)
          .eq('household_id', householdId)
          .eq('snake_id', snakeId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [householdId, refetch, snakeId]);

  const removeWeightRecord = useCallback(async (recordId: string) => {
    if (!householdId || !snakeId) throw new Error('No snake selected.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('snake_weight_records')
          .delete()
          .eq('id', recordId)
          .eq('household_id', householdId)
          .eq('snake_id', snakeId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [householdId, refetch, snakeId]);

  return {
    records: data ?? [],
    loading: !!householdId && !!snakeId && isLoading,
    addWeightRecord,
    updateWeightRecord,
    removeWeightRecord,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  };
}
