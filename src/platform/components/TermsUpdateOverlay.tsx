import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { TermsDocument } from './TermsDocument';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PendingVersion {
  version: string;
  changeDescription: string;
}

interface TermsUpdateOverlayProps {
  latestVersion: string;
  pendingVersions: PendingVersion[];
  onAgree: () => void;
}

const MAX_CHARS = 2000;

export function TermsUpdateOverlay({ latestVersion, pendingVersions, onAgree }: TermsUpdateOverlayProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isAgreeing, setIsAgreeing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const handleAgree = async () => {
    setIsAgreeing(true);
    try { await onAgree(); } finally { setIsAgreeing(false); }
  };

  const handleLogOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!user || !feedbackMessage.trim()) return;
    setIsSendingFeedback(true);
    try {
      // Save to DB
      const { error } = await supabase
        .from('bathos_feedback')
        .insert({ user_id: user.id, message: feedbackMessage.trim(), context: 'terms_update' });
      if (error) throw error;

      // Send email notification
      await supabase.functions.invoke('send-feedback-email', {
        body: { message: feedbackMessage.trim(), context: 'terms_update' },
      });

      setFeedbackSent(true);
      setShowFeedbackModal(false);
      setFeedbackMessage('');
      toast({ title: 'Feedback submitted', description: "Your message has been sent to the webmaster. They'll respond shortly." });
    } catch {
      toast({ title: 'Error', description: 'Could not send feedback. Please try again.', variant: 'destructive' });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const charCount = feedbackMessage.length;
  const charsRemaining = MAX_CHARS - charCount;
  const isOverLimit = charCount > MAX_CHARS;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/98 backdrop-blur-md" />

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFeedbackModal(false)} />
          <div className="relative w-full max-w-md bg-card rounded-lg border shadow-lg overflow-hidden">
            <div className="px-6 py-5 border-b">
              <h2 className="text-lg font-semibold text-center">Feedback</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Have a question or feedback about the updated terms? Send a message to the webmaster.
              </p>
              <div className="relative">
                <Textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Type your message…"
                  className="min-h-[140px] resize-none pr-3 pb-8"
                  maxLength={MAX_CHARS}
                  disabled={isSendingFeedback}
                />
                <div className={`absolute bottom-2 right-3 text-xs tabular-nums ${isOverLimit ? 'text-destructive font-medium' : charsRemaining <= 200 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  {charCount}/{MAX_CHARS}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowFeedbackModal(false)} className="flex-1" disabled={isSendingFeedback}>
                Cancel
              </Button>
              <Button
                onClick={handleSendFeedback}
                className="flex-1"
                disabled={isSendingFeedback || !feedbackMessage.trim() || isOverLimit}
              >
                {isSendingFeedback ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTermsModal(false)} />
          <div className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
            <div className="shrink-0 border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-center">Terms of Service and Privacy Policy</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-6">
              <TermsDocument className="text-sm md:text-[15px]" />
            </div>
            <div className="shrink-0 border-t px-6 py-4">
              <Button variant="outline" className="w-full" onClick={() => setShowTermsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Overlay */}
      <div className="relative w-full max-w-md bg-card rounded-lg border shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b">
          <h2 className="text-lg font-semibold text-center">Terms & Privacy Update</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-muted-foreground text-sm text-center">
            The{' '}
            <button
              type="button"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={() => setShowTermsModal(true)}
            >
              Terms of Service & Privacy Policy
            </button>{' '}
            have been updated.
          </p>
          {pendingVersions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What changed</p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {pendingVersions.map(v => (
                  <div key={v.version} className="bg-muted/50 rounded-md p-3 border">
                    <div className="text-xs font-semibold text-primary mb-1">v{v.version}</div>
                    <p className="text-sm text-muted-foreground">{v.changeDescription}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1" disabled={isAgreeing || isLoggingOut}>
                Inquire/Decline
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="z-[95] min-w-48 bg-popover">
              <DropdownMenuItem
                onClick={() => {
                  if (!feedbackSent) setShowFeedbackModal(true);
                }}
                disabled={feedbackSent}
              >
                {feedbackSent ? 'Feedback Sent' : 'Question/Feedback'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                Close Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogOut}>
                {isLoggingOut ? 'Logging out…' : 'Log Out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleAgree} className="flex-1" disabled={isAgreeing || isLoggingOut}>
            {isAgreeing ? 'Saving…' : 'Agree'}
          </Button>
        </div>
      </div>
      {showDeleteDialog && (
        <DeleteAccountDialog isOpen={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
      )}
    </div>,
    document.body
  );
}
