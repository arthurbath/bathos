import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import type { GarageUserSettings, GarageVehicle } from '@/modules/garage/types/garage';

const DEFAULT_SETTINGS = {
  upcoming_miles_default: 1000,
  upcoming_days_default: 60,
};

function garageQueryKey(userId: string | undefined) {
  return ['garage', 'vehicles', userId] as const;
}

export function useGarageVehicles(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = garageQueryKey(userId);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const [vehicles, settings] = await Promise.all([
        supabaseRequest(async () =>
          await supabase
            .from('garage_vehicles')
            .select('*')
            .eq('user_id', userId as string)
            .order('created_at', { ascending: true }),
        ),
        supabaseRequest(async () =>
          await supabase
            .from('garage_user_settings')
            .select('*')
            .eq('user_id', userId as string)
            .maybeSingle(),
        ),
      ]);

      return {
        vehicles: (vehicles as GarageVehicle[]) ?? [],
        settings: (settings as GarageUserSettings | null) ?? null,
      };
    },
  });

  const addVehicle = useCallback(async (input: {
    name: string;
    make?: string | null;
    model?: string | null;
    model_year?: number | null;
    in_service_date?: string | null;
    current_odometer_miles?: number;
    is_active?: boolean;
  }) => {
    if (!userId) throw new Error('Not authenticated.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_vehicles')
          .insert({
            user_id: userId,
            name: input.name,
            make: input.make ?? null,
            model: input.model ?? null,
            model_year: input.model_year ?? null,
            in_service_date: input.in_service_date ?? null,
            current_odometer_miles: input.current_odometer_miles ?? 0,
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

  const upsertSettings = useCallback(async (updates: Partial<Pick<GarageUserSettings, 'upcoming_days_default' | 'upcoming_miles_default'>>) => {
    if (!userId) throw new Error('Not authenticated.');

    try {
      const current = data?.settings;
      const payload = {
        user_id: userId,
        upcoming_miles_default: updates.upcoming_miles_default ?? current?.upcoming_miles_default ?? DEFAULT_SETTINGS.upcoming_miles_default,
        upcoming_days_default: updates.upcoming_days_default ?? current?.upcoming_days_default ?? DEFAULT_SETTINGS.upcoming_days_default,
        updated_at: new Date().toISOString(),
      };

      await supabaseRequest(async () =>
        await supabase
          .from('garage_user_settings')
          .upsert(payload, { onConflict: 'user_id' }),
      );

      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [data?.settings, refetch, userId]);

  const vehicles = useMemo(() => data?.vehicles ?? [], [data?.vehicles]);
  const activeVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.is_active) ?? vehicles[0] ?? null, [vehicles]);

  return {
    vehicles,
    settings: data?.settings ?? null,
    activeVehicle,
    loading: !!userId && isLoading,
    addVehicle,
    updateVehicle,
    removeVehicle,
    upsertSettings,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['garage'] });
    },
  };
}
