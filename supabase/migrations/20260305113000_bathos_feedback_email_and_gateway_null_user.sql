ALTER TABLE public.bathos_feedback
ADD COLUMN email TEXT;

UPDATE public.bathos_feedback AS feedback
SET email = users.email
FROM auth.users AS users
WHERE feedback.user_id = users.id
  AND feedback.email IS NULL
  AND users.email IS NOT NULL;

ALTER TABLE public.bathos_feedback
ALTER COLUMN user_id DROP NOT NULL;

UPDATE public.bathos_feedback
SET
  email = COALESCE(
    email,
    NULLIF(substring(message FROM '^\[([^\]]+)\]'), '')
  ),
  message = regexp_replace(message, '^\[[^\]]+\]\s*', '')
WHERE context = 'gateway';

UPDATE public.bathos_feedback
SET user_id = NULL
WHERE context = 'gateway';
