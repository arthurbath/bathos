DROP POLICY IF EXISTS "Authenticated users can upload feedback attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload feedback attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);