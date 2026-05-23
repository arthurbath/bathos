-- Rename the tone-example tags to the "Tone Example: {{Style}}" pattern and
-- add prose as a first-class tone example.

ALTER TABLE public.corpus_tags
  DROP CONSTRAINT IF EXISTS corpus_tags_name_allowed;

UPDATE public.corpus_tags
SET name = CASE name
    WHEN 'Personal Tone Example' THEN 'Tone Example: Personal'
    WHEN 'Professional Tone Example' THEN 'Tone Example: Professional'
    WHEN 'Technical Tone Example' THEN 'Tone Example: Technical'
    ELSE name
  END,
  description = CASE name
    WHEN 'Personal Tone Example' THEN 'Examples of personal, informal writing'
    WHEN 'Professional Tone Example' THEN 'Examples of workplace writing'
    WHEN 'Technical Tone Example' THEN 'Examples of technical writing'
    ELSE description
  END
WHERE name IN (
  'Personal Tone Example',
  'Professional Tone Example',
  'Technical Tone Example'
);

ALTER TABLE public.corpus_tags
  ADD CONSTRAINT corpus_tags_name_allowed CHECK (
    name IN (
      'Anti-patterns',
      'Biography',
      'Domain Knowledge',
      'Instructions',
      'Reference Material',
      'Style Conventions',
      'Template',
      'Tone Example: Personal',
      'Tone Example: Professional',
      'Tone Example: Prose',
      'Tone Example: Technical'
    )
  );

DROP POLICY IF EXISTS "Users can insert prescribed corpus tags" ON public.corpus_tags;

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
    'Reference Material',
    'Style Conventions',
    'Template',
    'Tone Example: Personal',
    'Tone Example: Professional',
    'Tone Example: Prose',
    'Tone Example: Technical'
  )
);

INSERT INTO public.corpus_tags (user_id, name, description)
SELECT settings.user_id, 'Tone Example: Prose', 'Examples of polished prose writing'
FROM public.corpus_settings settings
WHERE NOT EXISTS (
  SELECT 1
  FROM public.corpus_tags tags
  WHERE tags.user_id = settings.user_id
    AND tags.name = 'Tone Example: Prose'
);
