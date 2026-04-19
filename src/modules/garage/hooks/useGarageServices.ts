import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import type { GarageService, GarageServiceType } from '@/modules/garage/types/garage';
import type { GarageServiceImportRpcRow } from '@/modules/garage/lib/serviceImport';

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
    id?: string;
    name: string;
    type?: GarageServiceType | null;
    every_miles?: number | null;
    every_months?: number | null;
    monitoring?: boolean;
    notes?: string | null;
    sort_order?: number;
  }) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const nextOrder = ((data ?? []).reduce((max, row) => Math.max(max, row.sort_order), 0) || 0) + 1;
      const inserted = await supabaseRequest(async () =>
        await supabase
          .from('garage_services')
          .insert({
            id: input.id,
            user_id: userId,
            vehicle_id: vehicleId,
            name: input.name.trim(),
            type: input.type ?? null,
            cadence_type: deriveCadenceType(input.every_miles ?? null, input.every_months ?? null),
            every_miles: input.every_miles ?? null,
            every_months: input.every_months ?? null,
            monitoring: input.monitoring ?? false,
            notes: input.notes ?? null,
            sort_order: input.sort_order ?? nextOrder,
          })
          .select('*')
          .single(),
      );
      await refetch();
      return inserted as GarageService;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [data, refetch, userId, vehicleId]);

  const updateService = useCallback(async (id: string, updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const current = (queryClient.getQueryData<GarageService[]>(queryKey) ?? []).find((service) => service.id === id);
      const nextEveryMiles = updates.every_miles ?? current?.every_miles ?? null;
      const nextEveryMonths = updates.every_months ?? current?.every_months ?? null;
      const updatedAt = new Date().toISOString();
      const nextUpdates = {
        ...updates,
        name: typeof updates.name === 'string' ? updates.name.trim() : updates.name,
      };

      await supabaseRequest(async () =>
        await supabase
          .from('garage_services')
          .update({
            ...nextUpdates,
            cadence_type: deriveCadenceType(nextEveryMiles, nextEveryMonths),
            updated_at: updatedAt,
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
  }, [queryClient, queryKey, refetch, userId, vehicleId]);

  const importServices = useCallback(async (rows: GarageServiceImportRpcRow[]) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      await supabaseRequest(async () =>
        await supabase.rpc('garage_import_services_csv', {
          _vehicle_id: vehicleId,
          _rows: rows as Json,
        }),
      );
      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId, vehicleId]);

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
    importServices,
    removeService,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['garage', 'services', userId, vehicleId] });
    },
  };
}
