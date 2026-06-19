import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsDocument } from '@/platform/components/TermsDocument';

export default function GatewayFooter() {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <>
      <footer
        className="px-4 pt-4 border-t border-muted"
        style={{
          ['--gateway-footer-bottom-space' as string]: '1rem',
          paddingBottom: 'calc(var(--gateway-footer-bottom-space) + env(safe-area-inset-bottom, 0px))',
        }}
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
          <span className="select-none flex items-center gap-1"><Heart className="h-3 w-3" /> Art 2026</span>
        </div>
      </footer>

      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-4xl gap-0 p-0 sm:h-[90vh] sm:max-h-[90vh]">
          <DialogHeader className="border-b px-6 py-4 pb-4">
            <DialogTitle>Terms of Service and Privacy Policy</DialogTitle>
          </DialogHeader>
          <DialogBody className="border-y-0 px-6 py-4 md:px-8 md:py-6">
            <TermsDocument className="text-sm md:text-[15px]" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
