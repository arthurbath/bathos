DELETE FROM public.corpus_access_tokens
WHERE revoked_at IS NOT NULL;

DROP INDEX IF EXISTS public.corpus_access_tokens_user_visible_idx;

ALTER TABLE public.corpus_access_tokens
  DROP CONSTRAINT IF EXISTS corpus_access_tokens_hidden_requires_revoked;

ALTER TABLE public.corpus_access_tokens
  DROP COLUMN IF EXISTS hidden_at;
