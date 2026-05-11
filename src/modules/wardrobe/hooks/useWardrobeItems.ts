import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import type { WardrobeItem, WardrobeItemInput, WardrobeItemUpdate } from '@/modules/wardrobe/types/wardrobe';

function wardrobeItemsQueryKey(userId: string | undefined) {
  return ['wardrobe', 'items', userId] as const;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function normalizeItemInput(input: WardrobeItemInput): WardrobeItemInput {
  return {
    name: emptyToNull(input.name),
    category: input.category ?? null,
    brand: emptyToNull(input.brand),
    model: emptyToNull(input.model),
    color: emptyToNull(input.color),
    size: emptyToNull(input.size),
    link_url: emptyToNull(input.link_url),
    status: input.status ?? null,
    notes: emptyToNull(input.notes),
  };
}

function sortItems(items: WardrobeItem[]): WardrobeItem[] {
  return [...items].sort((left, right) => {
    const leftCreated = left.created_at ?? '';
    const rightCreated = right.created_at ?? '';
    return leftCreated.localeCompare(rightCreated);
  });
}

export function useWardrobeItems(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = wardrobeItemsQueryKey(userId);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const rows = await supabaseRequest(async () =>
        await supabase
          .from('wardrobe_items')
          .select('*')
          .eq('user_id', userId as string)
          .order('created_at', { ascending: true }),
      );
      return (rows as WardrobeItem[]) ?? [];
    },
  });

  const addItem = useCallback(async (input: WardrobeItemInput, id?: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      const inserted = await supabaseRequest(async () =>
        await supabase
          .from('wardrobe_items')
          .insert({
            ...(id ? { id } : {}),
            ...normalizeItemInput(input),
            user_id: userId,
          })
          .select('*')
          .single(),
      );

      queryClient.setQueryData<WardrobeItem[]>(queryKey, (current) =>
        sortItems([...(current ?? []), inserted as WardrobeItem]),
      );

      return inserted as WardrobeItem;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const updateItem = useCallback(async (id: string, updates: WardrobeItemUpdate) => {
    if (!userId) throw new Error('You must be signed in.');

    const normalizedUpdates: WardrobeItemUpdate = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, 'name') ? { name: emptyToNull(updates.name) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'brand') ? { brand: emptyToNull(updates.brand) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'model') ? { model: emptyToNull(updates.model) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'color') ? { color: emptyToNull(updates.color) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'size') ? { size: emptyToNull(updates.size) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'link_url') ? { link_url: emptyToNull(updates.link_url) } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'notes') ? { notes: emptyToNull(updates.notes) } : {}),
      updated_at: new Date().toISOString(),
    };

    try {
      const updated = await supabaseRequest(async () =>
        await supabase
          .from('wardrobe_items')
          .update(normalizedUpdates)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single(),
      );

      queryClient.setQueryData<WardrobeItem[]>(queryKey, (current) =>
        sortItems((current ?? []).map((item) => (
          item.id === id ? (updated as WardrobeItem) : item
        ))),
      );

      return updated as WardrobeItem;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const removeItem = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('wardrobe_items')
          .delete()
          .eq('id', id)
          .eq('user_id', userId),
      );

      queryClient.setQueryData<WardrobeItem[]>(queryKey, (current) =>
        (current ?? []).filter((item) => item.id !== id),
      );
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    items: data ?? [],
    loading: !!userId && isLoading,
    addItem,
    updateItem,
    removeItem,
  };
}
