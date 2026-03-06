import { type ReactNode, useRef, useState } from 'react';
import { Megaphone, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { ModuleId } from '@/platform/hooks/useHostModule';
import { useHostModule } from '@/platform/hooks/useHostModule';

const MAX_MESSAGE = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
];
const ACCEPT_STRING = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt';

interface FeedbackDialogProps {
  userId: string;
  trigger?: ReactNode;
}

export function getFeedbackContext(moduleId: ModuleId, pathname: string): string {
  if (moduleId) return `in_app_${moduleId}`;
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
  if (normalizedPath === '/account') return 'in_app_account';
  return 'in_app_switcher';
}

export function FeedbackDialog({ userId, trigger }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const moduleId = useHostModule();
  const feedbackContext = getFeedbackContext(moduleId, window.location.pathname);

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
    const userEmail = user?.email?.trim() ?? '';
    if (!trimmed) return;
    if (!userEmail) {
      toast({
        title: 'Failed to send feedback',
        description: 'No email address is available for this account.',
        variant: 'destructive',
      });
      return;
    }
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
        // Send the storage path (not a public URL) — the edge function
        // generates a short-lived signed URL for the email.
        fileUrl = path;
      }

      // Save to DB
      const { error: insertErr } = await supabase.from('bathos_feedback').insert({
        user_id: userId,
        email: userEmail,
        message: trimmed,
        context: feedbackContext,
      });
      if (insertErr) throw insertErr;

      // Send email
      await supabase.functions.invoke('send-feedback-email', {
        body: { message: trimmed, context: feedbackContext, file_url: fileUrl },
      });

      toast({ title: 'Feedback sent' });
      reset();
      setOpen(false);
    } catch (err: unknown) {
      toast({
        title: 'Failed to send feedback',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="clear" size="sm" className="h-9 w-9 p-0" title="Send feedback">
            <Megaphone className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Feedback / Bug Report</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4 pt-5">
          <div>
            <Textarea
              placeholder="Tell me something"
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
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 ml-auto"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Attach File
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
        </DialogBody>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!message.trim() || sending}>
            {sending ? 'Sending...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
