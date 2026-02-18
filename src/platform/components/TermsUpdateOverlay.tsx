import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from './DeleteAccountDialog';

interface PendingVersion {
  version: string;
  changeDescription: string;
}

interface TermsUpdateOverlayProps {
  latestVersion: string;
  pendingVersions: PendingVersion[];
  onAgree: () => void;
}

export function TermsUpdateOverlay({ latestVersion, pendingVersions, onAgree }: TermsUpdateOverlayProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAgreeing, setIsAgreeing] = useState(false);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const handleAgree = async () => {
    setIsAgreeing(true);
    try { await onAgree(); } finally { setIsAgreeing(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/98 backdrop-blur-md" />
      <div className="relative w-full max-w-md bg-card rounded-lg border shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b">
          <h2 className="text-lg font-semibold text-center">Terms & Privacy Update</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-muted-foreground text-sm text-center">
            The{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              Terms of Service & Privacy Policy
            </a>{' '}
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
          <Button variant="outline" onClick={() => setShowDeleteDialog(true)} className="flex-1" disabled={isAgreeing}>
            Disagree
          </Button>
          <Button onClick={handleAgree} className="flex-1" disabled={isAgreeing}>
            {isAgreeing ? 'Saving...' : 'Agree'}
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
