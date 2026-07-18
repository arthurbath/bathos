import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import type { GarageVehicle } from '@/modules/garage/types/garage';

function garageQueryKey(userId: string | undefined) {
  return ['garage', 'vehicles', userId] as const;
}

export function useGarageVehicles(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = garageQueryKey(userId);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => (await supabaseRequest(async () =>
      await supabase
        .from('garage_vehicles')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: true }),
    )) as GarageVehicle[],
  });

  const addVehicle = useCallback(async (input: {
    id?: string;
    name: string;
    make?: string | null;
    model?: string | null;
    model_year?: number | null;
    in_service_date?: string | null;
    current_odometer_miles?: number;
    upcoming_miles?: number;
    upcoming_days?: number;
    is_active?: boolean;
  }) => {
    if (!userId) throw new Error('Not authenticated.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_vehicles')
          .insert({
            id: input.id,
            user_id: userId,
            name: input.name,
            make: input.make ?? null,
            model: input.model ?? null,
            model_year: input.model_year ?? null,
            in_service_date: input.in_service_date ?? null,
            current_odometer_miles: input.current_odometer_miles ?? 0,
            upcoming_miles: input.upcoming_miles ?? 1000,
            upcoming_days: input.upcoming_days ?? 60,
            is_active: input.is_active ?? true,
          }),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId]);

  const updateVehicle = useCallback(async (id: string, updates: Partial<Omit<GarageVehicle, 'id' | 'user_id' | 'created_at'>>) => {
    if (!userId) throw new Error('Not authenticated.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_vehicles')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId]);

  const removeVehicle = useCallback(async (vehicleId: string) => {
    if (!userId) throw new Error('Not authenticated.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_vehicles')
          .delete()
          .eq('id', vehicleId)
          .eq('user_id', userId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId]);

  const vehicles = useMemo(() => data ?? [], [data]);
  const activeVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.is_active) ?? vehicles[0] ?? null, [vehicles]);

  return {
    vehicles,
    activeVehicle,
    loading: !!userId && isLoading,
    addVehicle,
    updateVehicle,
    removeVehicle,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['garage'] });
    },
  };
}
