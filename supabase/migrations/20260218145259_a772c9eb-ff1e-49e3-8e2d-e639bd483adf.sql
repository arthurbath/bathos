
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-attachments', 'feedback-attachments', true);

CREATE POLICY "Authenticated users can upload feedback attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'feedback-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view feedback attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'feedback-attachments');
