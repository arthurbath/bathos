import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import type { GarageService, GarageServiceType } from '@/modules/garage/types/garage';

function garageServicesQueryKey(userId: string | undefined, vehicleId: string | null | undefined) {
  return ['garage', 'services', userId, vehicleId] as const;
}

function deriveCadenceType(everyMiles?: number | null, everyMonths?: number | null): GarageService['cadence_type'] {
  const hasMiles = typeof everyMiles === 'number' && everyMiles > 0;
  const hasMonths = typeof everyMonths === 'number' && everyMonths > 0;
  return hasMiles || hasMonths ? 'recurring' : 'no_interval';
}

export function useGarageServices(userId: string | undefined, vehicleId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = garageServicesQueryKey(userId, vehicleId);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId && !!vehicleId,
    queryFn: async () => {
      const rows = await supabaseRequest(async () =>
        await supabase
          .from('garage_services')
          .select('*')
          .eq('user_id', userId as string)
          .eq('vehicle_id', vehicleId as string)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      );
      return (rows as GarageService[]) ?? [];
    },
  });

  const addService = useCallback(async (input: {
    name: string;
    type: GarageServiceType;
    every_miles?: number | null;
    every_months?: number | null;
    monitoring?: boolean;
    notes?: string | null;
  }) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const nextOrder = ((data ?? []).reduce((max, row) => Math.max(max, row.sort_order), 0) || 0) + 1;
      await supabaseRequest(async () =>
        await supabase.from('garage_services').insert({
          user_id: userId,
          vehicle_id: vehicleId,
          name: input.name,
          type: input.type,
          cadence_type: deriveCadenceType(input.every_miles ?? null, input.every_months ?? null),
          every_miles: input.every_miles ?? null,
          every_months: input.every_months ?? null,
          monitoring: input.monitoring ?? false,
          notes: input.notes ?? null,
          sort_order: nextOrder,
        }),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [data, refetch, userId, vehicleId]);

  const updateService = useCallback(async (id: string, updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const current = (data ?? []).find((service) => service.id === id);
      const nextEveryMiles = updates.every_miles ?? current?.every_miles ?? null;
      const nextEveryMonths = updates.every_months ?? current?.every_months ?? null;
      await supabaseRequest(async () =>
        await supabase
          .from('garage_services')
          .update({
            ...updates,
            cadence_type: deriveCadenceType(nextEveryMiles, nextEveryMonths),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [data, refetch, userId, vehicleId]);

  const removeService = useCallback(async (serviceId: string) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_services')
          .delete()
          .eq('id', serviceId)
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId, vehicleId]);

  return {
    services: data ?? [],
    loading: !!userId && !!vehicleId && isLoading,
    addService,
    updateService,
    removeService,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['garage', 'services', userId, vehicleId] });
    },
  };
}
