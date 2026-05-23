import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import type { CorpusDocument, CorpusDocumentInput, CorpusDocumentUpdate, CorpusTag } from '@/modules/corpus/types/corpus';

type CorpusDocumentRow = Omit<CorpusDocument, 'tags'> & {
  corpus_document_tags?: Array<{ tag: CorpusTag | null }>;
};

function corpusDocumentsQueryKey(userId: string | undefined) {
  return ['corpus', 'documents', userId] as const;
}

function mapDocument(row: CorpusDocumentRow): CorpusDocument {
  return {
    ...row,
    tags: (row.corpus_document_tags ?? [])
      .map((entry) => entry.tag)
      .filter((tag): tag is CorpusTag => Boolean(tag))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
  };
}

function sortDocuments(documents: CorpusDocument[]) {
  return [...documents].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function normalizeTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Title is required.');
  return trimmed;
}

async function replaceDocumentTags(userId: string, documentId: string, tagIds: string[]) {
  await supabaseRequest(async () =>
    await supabase
      .from('corpus_document_tags')
      .delete()
      .eq('user_id', userId)
      .eq('document_id', documentId),
  );

  const uniqueTagIds = Array.from(new Set(tagIds));
  if (uniqueTagIds.length === 0) return;

  await supabaseRequest(async () =>
    await supabase
      .from('corpus_document_tags')
      .insert(uniqueTagIds.map((tagId) => ({ user_id: userId, document_id: documentId, tag_id: tagId }))),
  );
}

export function useCorpusDocuments(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = corpusDocumentsQueryKey(userId);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const rows = await supabaseRequest(async () =>
        await supabase
          .from('corpus_documents')
          .select('*, corpus_document_tags(tag:corpus_tags(*))')
          .eq('user_id', userId as string)
          .order('updated_at', { ascending: false }),
      );
      return sortDocuments(((rows as CorpusDocumentRow[]) ?? []).map(mapDocument));
    },
  });

  const refreshDocuments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const addDocument = useCallback(async (input: CorpusDocumentInput, id?: string) => {
    if (!userId) throw new Error('You must be signed in.');
    const now = new Date().toISOString();

    try {
      const saved = await supabaseRequest(async () =>
        await supabase
          .from('corpus_documents')
          .insert({
            ...(id ? { id } : {}),
            user_id: userId,
            title: normalizeTitle(input.title),
            content: input.content,
            content_type: input.content_type,
            source_filename: input.source_filename?.trim() || null,
            updated_at: now,
          })
          .select('*, corpus_document_tags(tag:corpus_tags(*))')
          .single(),
      ) as CorpusDocumentRow;

      if (input.tagIds) {
        await replaceDocumentTags(userId, saved.id, input.tagIds);
      }

      await refreshDocuments();
      return mapDocument(saved);
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refreshDocuments, userId]);

  const updateDocument = useCallback(async (id: string, updates: CorpusDocumentUpdate) => {
    if (!userId) throw new Error('You must be signed in.');
    const payload = {
      ...updates,
      ...(updates.title !== undefined ? { title: normalizeTitle(updates.title) } : {}),
      ...(updates.source_filename !== undefined ? { source_filename: updates.source_filename?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    };

    try {
      const saved = await supabaseRequest(async () =>
        await supabase
          .from('corpus_documents')
          .update(payload)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*, corpus_document_tags(tag:corpus_tags(*))')
          .single(),
      ) as CorpusDocumentRow;

      const mapped = mapDocument(saved);
      queryClient.setQueryData<CorpusDocument[]>(queryKey, (current) =>
        sortDocuments((current ?? []).map((document) => (document.id === id ? mapped : document))),
      );
      return mapped;
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  const setDocumentTags = useCallback(async (documentId: string, tagIds: string[]) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await replaceDocumentTags(userId, documentId, tagIds);
      await refreshDocuments();
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [refreshDocuments, userId]);

  const removeDocument = useCallback(async (id: string) => {
    if (!userId) throw new Error('You must be signed in.');

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('corpus_documents')
          .delete()
          .eq('id', id)
          .eq('user_id', userId),
      );
      queryClient.setQueryData<CorpusDocument[]>(queryKey, (current) => (current ?? []).filter((document) => document.id !== id));
    } catch (error) {
      showMutationError(error);
      throw error;
    }
  }, [queryClient, queryKey, userId]);

  return {
    documents: data ?? [],
    loading: !!userId && isLoading,
    addDocument,
    updateDocument,
    setDocumentTags,
    removeDocument,
  };
}
