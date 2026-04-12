DROP POLICY IF EXISTS "Users can submit their own feedback" ON public.bathos_feedback;

CREATE POLICY "Users can submit feedback"
ON public.bathos_feedback
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (auth.uid() IS NULL AND user_id IS NULL)
);
