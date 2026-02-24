-- Make feedback-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'feedback-attachments';

-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "Anyone can view feedback attachments" ON storage.objects;

-- Allow only admins to view feedback attachments
CREATE POLICY "Admins can view feedback attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND public.has_role(auth.uid(), 'admin')
);