-- Corpus module schema (personal, user-owned)

CREATE TABLE public.corpus_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_tags_created boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.corpus_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT corpus_tags_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX corpus_tags_user_name_key
ON public.corpus_tags (user_id, lower(btrim(name)));

CREATE TABLE public.corpus_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'markdown',
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT corpus_documents_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT corpus_documents_content_type_valid CHECK (content_type IN ('markdown', 'plain_text'))
);

CREATE TABLE public.corpus_document_tags (
  document_id uuid NOT NULL REFERENCES public.corpus_documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.corpus_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE public.corpus_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT corpus_access_tokens_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT corpus_access_tokens_hash_not_blank CHECK (btrim(token_hash) <> '')
);

CREATE INDEX corpus_documents_user_updated_idx ON public.corpus_documents (user_id, updated_at DESC);
CREATE INDEX corpus_documents_user_title_idx ON public.corpus_documents (user_id, lower(btrim(title)));
CREATE INDEX corpus_documents_search_idx ON public.corpus_documents
USING gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
CREATE INDEX corpus_document_tags_user_tag_idx ON public.corpus_document_tags (user_id, tag_id);
CREATE INDEX corpus_access_tokens_user_active_idx ON public.corpus_access_tokens (user_id, revoked_at);

ALTER TABLE public.corpus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corpus settings"
ON public.corpus_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corpus settings"
ON public.corpus_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corpus settings"
ON public.corpus_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own corpus tags"
ON public.corpus_tags
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corpus tags"
ON public.corpus_tags
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corpus tags"
ON public.corpus_tags
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own corpus tags"
ON public.corpus_tags
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own corpus documents"
ON public.corpus_documents
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corpus documents"
ON public.corpus_documents
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corpus documents"
ON public.corpus_documents
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own corpus documents"
ON public.corpus_documents
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own corpus document tags"
ON public.corpus_document_tags
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corpus document tags"
ON public.corpus_document_tags
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.corpus_documents d
    WHERE d.id = document_id AND d.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.corpus_tags t
    WHERE t.id = tag_id AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own corpus document tags"
ON public.corpus_document_tags
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own corpus access tokens"
ON public.corpus_access_tokens
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corpus access tokens"
ON public.corpus_access_tokens
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corpus access tokens"
ON public.corpus_access_tokens
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own corpus access tokens"
ON public.corpus_access_tokens
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corpus_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corpus_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corpus_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corpus_document_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corpus_access_tokens TO authenticated;
