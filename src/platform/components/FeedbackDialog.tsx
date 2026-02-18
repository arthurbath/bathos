import { useState, useRef } from 'react';
import { Megaphone, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const MAX_MESSAGE = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
];
const ACCEPT_STRING = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt';

interface FeedbackDialogProps {
  userId: string;
}

export function FeedbackDialog({ userId }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMessage('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast({ title: 'Unsupported file type', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: 'File must be under 5 MB', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);

    try {
      let fileUrl: string | undefined;

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${userId}/${Date.now()}_feedback.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('feedback-attachments')
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from('feedback-attachments')
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      // Save to DB
      await supabase.from('bathos_feedback').insert({
        user_id: userId,
        message: trimmed,
        context: 'in_app_feedback_bug',
      });

      // Send email
      await supabase.functions.invoke('send-feedback-email', {
        body: { message: trimmed, context: 'in_app_feedback_bug', file_url: fileUrl },
      });

      toast({ title: 'Feedback sent' });
      reset();
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Failed to send feedback', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Send feedback">
          <Megaphone className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback &amp; Bug Reports</DialogTitle>
          <DialogDescription>
            Found a bug or have a suggestion? Let us know.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Textarea
              placeholder="Describe the issue or share your thoughts..."
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              rows={5}
            />
            <p className="mt-1 text-xs text-muted-foreground text-right">
              {message.length}/{MAX_MESSAGE}
            </p>
          </div>

          <div>
            {file ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-auto"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Attach file
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_STRING}
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPEG, GIF, WebP, PDF, or TXT — max 5 MB
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!message.trim() || sending}>
            {sending ? 'Sending...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
