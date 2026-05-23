import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import { CORPUS_DEFAULT_TAGS } from '@/modules/corpus/lib/defaultTags';
import type { CorpusTag } from '@/modules/corpus/types/corpus';

function corpusTagsQueryKey(userId: string | undefined) {
  return ['corpus', 'tags', userId] as const;
}

function sortTags(tags: CorpusTag[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

function normalizeName(name: string) {
  return name.trim();
}

export function useCorpusTags(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = corpusTagsQueryKey(userId);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const settingsRows = await supabaseRequest(async () =>
        await supabase
          .from('corpus_settings')
          .select('user_id, default_tags_created')
          .eq('user_id', userId as string)
          .maybeSingle(),
      ) as { user_id: string; default_tags_created: boolean } | null;

      const existingTags = await supabaseRequest(async () =>
        await supabase
          .from('corpus_tags')
          .select('name')
          .eq('user_id', userId as string),
      ) as Array<{ name: string }> | null;
      const existingNames = new Set((existingTags ?? []).map((tag) => tag.name.trim().toLocaleLowerCase()));

      if (!settingsRows?.default_tags_created) {
        const missingTags = CORPUS_DEFAULT_TAGS
          .filter((tag) => !existingNames.has(tag.name.toLocaleLowerCase()))
          .map((tag) => ({ ...tag, user_id: userId as string }));

        if (missingTags.length > 0) {
          await supabaseRequest(async () => await supabase.from('corpus_tags').insert(missingTags));
        }

        await supabaseRequest(async () =>
          await supabase
            .from('corpus_settings')
            .upsert({
              user_id: userId as string,
              default_tags_created: true,
              updated_at: new Date().toISOString(),
            }),
        );
      }

      const rows = await supabaseRequest(async () =>
        await supabase
          .from('corpus_tags')
          .select('*')
          .eq('user_id', userId as string)
          .order('name'),
      );
      return sortTags((rows as CorpusTag[]) ?? []);
    },
  });

  const addTag = useCallback(async (name: string, description: string | null = null, id?: string) => {
    if (!userId) throw new Error('You must be signed in.');
    const nextName = normalizeName(name);
    if (!nextName) throw new Error('Tag name is required.');

    try {
      const saved = await supabaseRequest(async () =>
        await supabase
          .from('corpus_tags')
          .insert({ ...(id ? { id } : {}), user_id: userId, name: nextName, description })
          .select('*')
          .single(),
      ) as CorpusTag;

      queryClient.setQueryData<CorpusTag[]>(queryKey, (current) => sortTags([...(current ?? []), saved]));
      return saved;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const updateTag = useCallback(async (id: string, updates: { name?: string; description?: string | null }) => {
    if (!userId) throw new Error('You must be signed in.');
    const payload = {
      ...updates,
      ...(updates.name !== undefined ? { name: normalizeName(updates.name) } : {}),
      updated_at: new Date().toISOString(),
    };

    try {
      const saved = await supabaseRequest(async () =>
        await supabase
          .from('corpus_tags')
          .update(payload)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single(),
      ) as CorpusTag;

      queryClient.setQueryData<CorpusTag[]>(queryKey, (current) =>
        sortTags((current ?? []).map((tag) => (tag.id === id ? saved : tag))),
      );
      return saved;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const removeTag = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('corpus_tags')
          .delete()
          .eq('id', id)
          .eq('user_id', userId),
      );
      queryClient.setQueryData<CorpusTag[]>(queryKey, (current) => (current ?? []).filter((tag) => tag.id !== id));
      queryClient.invalidateQueries({ queryKey: ['corpus', 'documents', userId] });
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    tags: data ?? [],
    loading: !!userId && isLoading,
    addTag,
    updateTag,
    removeTag,
  };
}
