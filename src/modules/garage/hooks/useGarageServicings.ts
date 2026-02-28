import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest, showMutationError } from '@/lib/supabaseRequest';
import type {
  GarageServicing,
  GarageServicingReceipt,
  GarageServicingService,
  GarageServicingWithRelations,
  GarageServiceStatus,
} from '@/modules/garage/types/garage';

interface OutcomeInput {
  service_id: string;
  status: GarageServiceStatus;
}

function garageServicingsQueryKey(userId: string | undefined, vehicleId: string | null | undefined) {
  return ['garage', 'servicings', userId, vehicleId] as const;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function useGarageServicings(userId: string | undefined, vehicleId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = garageServicingsQueryKey(userId, vehicleId);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId && !!vehicleId,
    queryFn: async () => {
      const servicings = await supabaseRequest(async () =>
        await supabase
          .from('garage_servicings')
          .select('*')
          .eq('user_id', userId as string)
          .eq('vehicle_id', vehicleId as string)
          .order('service_date', { ascending: false })
          .order('created_at', { ascending: false }),
      );

      const servicingRows = (servicings as GarageServicing[]) ?? [];
      if (servicingRows.length === 0) return [] as GarageServicingWithRelations[];

      const servicingIds = servicingRows.map((row) => row.id);

      const [outcomes, receipts] = await Promise.all([
        supabaseRequest(async () =>
          await supabase
            .from('garage_servicing_services')
            .select('*')
            .eq('user_id', userId as string)
            .eq('vehicle_id', vehicleId as string)
            .in('servicing_id', servicingIds),
        ),
        supabaseRequest(async () =>
          await supabase
            .from('garage_servicing_receipts')
            .select('*')
            .eq('user_id', userId as string)
            .eq('vehicle_id', vehicleId as string)
            .in('servicing_id', servicingIds)
            .order('created_at', { ascending: true }),
        ),
      ]);

      const outcomeRows = (outcomes as GarageServicingService[]) ?? [];
      const receiptRows = (receipts as GarageServicingReceipt[]) ?? [];

      return servicingRows.map((servicing) => ({
        ...servicing,
        outcomes: outcomeRows.filter((row) => row.servicing_id === servicing.id),
        receipts: receiptRows.filter((row) => row.servicing_id === servicing.id),
      }));
    },
  });

  const uploadReceipts = useCallback(async (args: {
    servicingId: string;
    files: File[];
  }) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');
    const rows: Omit<GarageServicingReceipt, 'id' | 'created_at'>[] = [];

    for (const file of args.files) {
      const storagePath = `${userId}/${vehicleId}/${args.servicingId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

      const uploadResult = await supabase.storage
        .from('garage-receipts')
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadResult.error) {
        throw new Error(`Failed to upload receipt: ${uploadResult.error.message}`);
      }

      rows.push({
        user_id: userId,
        vehicle_id: vehicleId,
        servicing_id: args.servicingId,
        storage_object_path: storagePath,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
    }

    if (rows.length > 0) {
      await supabaseRequest(async () =>
        await supabase.from('garage_servicing_receipts').insert(rows),
      );
    }
  }, [userId, vehicleId]);

  const saveOutcomes = useCallback(async (servicingId: string, outcomes: OutcomeInput[]) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    await supabaseRequest(async () =>
      await supabase
        .from('garage_servicing_services')
        .delete()
        .eq('servicing_id', servicingId)
        .eq('user_id', userId)
        .eq('vehicle_id', vehicleId),
    );

    const deduped = Array.from(
      new Map(outcomes.map((outcome) => [outcome.service_id, outcome])).values(),
    );

    if (deduped.length > 0) {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_servicing_services')
          .insert(
            deduped.map((outcome) => ({
              user_id: userId,
              vehicle_id: vehicleId,
              servicing_id: servicingId,
              service_id: outcome.service_id,
              status: outcome.status,
            })),
          ),
      );
    }
  }, [userId, vehicleId]);

  const addServicing = useCallback(async (input: {
    service_date: string;
    odometer_miles: number;
    shop_name?: string | null;
    notes?: string | null;
    outcomes: OutcomeInput[];
    receipt_files?: File[];
  }) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const servicingId = crypto.randomUUID();

      await supabaseRequest(async () =>
        await supabase.from('garage_servicings').insert({
          id: servicingId,
          user_id: userId,
          vehicle_id: vehicleId,
          service_date: input.service_date,
          odometer_miles: input.odometer_miles,
          shop_name: input.shop_name ?? null,
          notes: input.notes ?? null,
        }),
      );

      await saveOutcomes(servicingId, input.outcomes);

      if ((input.receipt_files ?? []).length > 0) {
        await uploadReceipts({ servicingId, files: input.receipt_files ?? [] });
      }

      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, saveOutcomes, uploadReceipts, userId, vehicleId]);

  const updateServicing = useCallback(async (servicingId: string, input: {
    service_date: string;
    odometer_miles: number;
    shop_name?: string | null;
    notes?: string | null;
    outcomes: OutcomeInput[];
    receipt_files?: File[];
  }) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('garage_servicings')
          .update({
            service_date: input.service_date,
            odometer_miles: input.odometer_miles,
            shop_name: input.shop_name ?? null,
            notes: input.notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', servicingId)
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId),
      );

      await saveOutcomes(servicingId, input.outcomes);

      if ((input.receipt_files ?? []).length > 0) {
        await uploadReceipts({ servicingId, files: input.receipt_files ?? [] });
      }

      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, saveOutcomes, uploadReceipts, userId, vehicleId]);

  const removeServicing = useCallback(async (servicingId: string) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const receipts = await supabaseRequest(async () =>
        await supabase
          .from('garage_servicing_receipts')
          .select('id, storage_object_path')
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId)
          .eq('servicing_id', servicingId),
      );

      const paths = (receipts ?? []).map((row: { storage_object_path: string }) => row.storage_object_path);
      if (paths.length > 0) {
        const deleteResult = await supabase.storage.from('garage-receipts').remove(paths);
        if (deleteResult.error) {
          throw new Error(`Failed to delete receipt files: ${deleteResult.error.message}`);
        }
      }

      await supabaseRequest(async () =>
        await supabase
          .from('garage_servicings')
          .delete()
          .eq('id', servicingId)
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId),
      );

      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId, vehicleId]);

  const removeReceipt = useCallback(async (receiptId: string, storagePath: string) => {
    if (!userId || !vehicleId) throw new Error('No active vehicle selected.');

    try {
      const deleteResult = await supabase.storage.from('garage-receipts').remove([storagePath]);
      if (deleteResult.error) {
        throw new Error(`Failed to delete receipt file: ${deleteResult.error.message}`);
      }

      await supabaseRequest(async () =>
        await supabase
          .from('garage_servicing_receipts')
          .delete()
          .eq('id', receiptId)
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId),
      );

      await refetch();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refetch, userId, vehicleId]);

  const createReceiptSignedUrl = useCallback(async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('garage-receipts')
      .createSignedUrl(storagePath, 60 * 10);

    if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
    if (!data?.signedUrl) throw new Error('Signed URL was not returned.');
    return data.signedUrl;
  }, []);

  return {
    servicings: data ?? [],
    loading: !!userId && !!vehicleId && isLoading,
    addServicing,
    updateServicing,
    removeServicing,
    removeReceipt,
    createReceiptSignedUrl,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['garage', 'servicings', userId, vehicleId] });
    },
  };
}
