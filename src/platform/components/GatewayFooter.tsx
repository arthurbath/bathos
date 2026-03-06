import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsDocument } from '@/platform/components/TermsDocument';

export default function GatewayFooter() {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <>
      <footer
        className="px-4 pt-4 border-t border-muted"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between text-muted-foreground text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hover:text-foreground transition-colors"
              onClick={() => setShowTerms(true)}
            >
              Terms
            </button>
            <span className="text-muted-foreground/40">|</span>
            <Link to="/help" className="hover:text-foreground transition-colors">
              Help
            </Link>
          </div>
          <span className="select-none">❤️ Art 2026</span>
        </div>
      </footer>

      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Terms of Service and Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-6">
            <TermsDocument className="text-sm md:text-[15px]" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
