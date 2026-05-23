import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import type { CorpusAccessToken } from '@/modules/corpus/types/corpus';

function corpusAccessTokensQueryKey(userId: string | undefined) {
  return ['corpus', 'access_tokens', userId] as const;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `bathos_corpus_${encoded}`;
}

export function useCorpusAccessTokens(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = corpusAccessTokensQueryKey(userId);
  const [newToken, setNewToken] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const rows = await supabaseRequest(async () =>
        await supabase
          .from('corpus_access_tokens')
          .select('id, user_id, name, created_at, last_used_at, revoked_at, hidden_at')
          .eq('user_id', userId as string)
          .is('hidden_at', null)
          .order('created_at', { ascending: false }),
      );
      return (rows as CorpusAccessToken[]) ?? [];
    },
  });

  const createToken = useCallback(async (name: string) => {
    if (!userId) throw new Error('You must be signed in.');
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Token name is required.');
    const token = generateToken();
    const tokenHash = await sha256Hex(token);

    try {
      const saved = await supabaseRequest(async () =>
        await supabase
          .from('corpus_access_tokens')
          .insert({ user_id: userId, name: trimmedName, token_hash: tokenHash })
          .select('id, user_id, name, created_at, last_used_at, revoked_at, hidden_at')
          .single(),
      ) as CorpusAccessToken;
      setNewToken(token);
      queryClient.setQueryData<CorpusAccessToken[]>(queryKey, (current) => [saved, ...(current ?? [])]);
      return token;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const revokeToken = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');
    const revokedAt = new Date().toISOString();

    try {
      const saved = await supabaseRequest(async () =>
        await supabase
          .from('corpus_access_tokens')
          .update({ revoked_at: revokedAt })
          .eq('id', id)
          .eq('user_id', userId)
          .select('id, user_id, name, created_at, last_used_at, revoked_at, hidden_at')
          .single(),
      ) as CorpusAccessToken;

      queryClient.setQueryData<CorpusAccessToken[]>(queryKey, (current) =>
        (current ?? []).map((token) => (token.id === id ? saved : token)),
      );
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const hideToken = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');
    const hiddenAt = new Date().toISOString();

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('corpus_access_tokens')
          .update({ hidden_at: hiddenAt })
          .eq('id', id)
          .eq('user_id', userId)
          .not('revoked_at', 'is', null),
      );

      queryClient.setQueryData<CorpusAccessToken[]>(queryKey, (current) =>
        (current ?? []).filter((token) => token.id !== id),
      );
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    tokens: data ?? [],
    loading: !!userId && isLoading,
    newToken,
    clearNewToken: () => setNewToken(null),
    createToken,
    revokeToken,
    hideToken,
  };
}
