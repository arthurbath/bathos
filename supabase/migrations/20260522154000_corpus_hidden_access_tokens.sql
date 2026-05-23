ALTER TABLE public.corpus_access_tokens
ADD COLUMN hidden_at timestamptz;

ALTER TABLE public.corpus_access_tokens
ADD CONSTRAINT corpus_access_tokens_hidden_requires_revoked
CHECK (hidden_at IS NULL OR revoked_at IS NOT NULL);

CREATE INDEX corpus_access_tokens_user_visible_idx
ON public.corpus_access_tokens (user_id, hidden_at, created_at DESC);
