-- Corpus now uses a prescribed tag vocabulary so MCP clients can rely on
-- stable retrieval instructions instead of account-specific custom tags.

DELETE FROM public.corpus_document_tags;
DELETE FROM public.corpus_tags;

ALTER TABLE public.corpus_tags
  DROP CONSTRAINT IF EXISTS corpus_tags_name_allowed;

ALTER TABLE public.corpus_tags
  ADD CONSTRAINT corpus_tags_name_allowed CHECK (
    name IN (
      'Anti-patterns',
      'Biography',
      'Domain Knowledge',
      'Instructions',
      'Personal Tone Example',
      'Professional Tone Example',
      'Reference Material',
      'Style Conventions',
      'Technical Tone Example',
      'Template'
    )
  );

DROP POLICY IF EXISTS "Users can update own corpus tags" ON public.corpus_tags;
DROP POLICY IF EXISTS "Users can delete own corpus tags" ON public.corpus_tags;

CREATE POLICY "Users can insert prescribed corpus tags"
ON public.corpus_tags
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND name IN (
    'Anti-patterns',
    'Biography',
    'Domain Knowledge',
    'Instructions',
    'Personal Tone Example',
    'Professional Tone Example',
    'Reference Material',
    'Style Conventions',
    'Technical Tone Example',
    'Template'
  )
);

DROP POLICY IF EXISTS "Users can insert own corpus tags" ON public.corpus_tags;

INSERT INTO public.corpus_tags (user_id, name, description)
SELECT user_id, tag.name, tag.description
FROM public.corpus_settings
CROSS JOIN (
  VALUES
    ('Anti-patterns', 'Phrases, tones, structures, and habits to avoid'),
    ('Biography', 'Documents that describe who you are'),
    ('Domain Knowledge', 'Reusable subject-matter context'),
    ('Instructions', 'General instructions, preferences, rules, and reusable guidance'),
    ('Personal Tone Example', 'Examples of personal, informal writing'),
    ('Professional Tone Example', 'Examples of workplace writing'),
    ('Reference Material', 'Source material to consult when answering or drafting'),
    ('Style Conventions', 'Spelling, grammar, formatting, naming, and usage conventions'),
    ('Technical Tone Example', 'Examples of technical writing'),
    ('Template', 'Reusable structures, formats, and boilerplate')
) AS tag(name, description);

UPDATE public.corpus_settings
SET default_tags_created = true,
    updated_at = now();
