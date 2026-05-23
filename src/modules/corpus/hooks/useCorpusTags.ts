import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest } from '@/lib/supabaseRequest';
import { CORPUS_DEFAULT_TAGS } from '@/modules/corpus/lib/defaultTags';
import type { CorpusTag } from '@/modules/corpus/types/corpus';

function corpusTagsQueryKey(userId: string | undefined) {
  return ['corpus', 'tags', userId] as const;
}

function sortTags(tags: CorpusTag[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

export function useCorpusTags(userId: string | undefined) {
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

      const missingTags = CORPUS_DEFAULT_TAGS
        .filter((tag) => !existingNames.has(tag.name.toLocaleLowerCase()))
        .map((tag) => ({ ...tag, user_id: userId as string }));

      if (missingTags.length > 0) {
        await supabaseRequest(async () => await supabase.from('corpus_tags').insert(missingTags));
      }

      if (!settingsRows?.default_tags_created || missingTags.length > 0) {
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

  return {
    tags: data ?? [],
    loading: !!userId && isLoading,
  };
}
