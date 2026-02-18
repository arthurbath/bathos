import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TermsDocument } from '@/platform/components/TermsDocument';

export default function TermsPage() {
  const navigate = useNavigate();
  const handleBack = () => {
    const fallbackPath = window.location.hostname === 'budget.bath.garden' ? '/summary' : '/';
    const referrer = document.referrer;

    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const currentUrl = new URL(window.location.href);
        const isSameOrigin = refUrl.origin === currentUrl.origin;
        const isDifferentPage = `${refUrl.pathname}${refUrl.search}${refUrl.hash}` !== `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
        if (isSameOrigin && isDifferentPage) {
          navigate(`${refUrl.pathname}${refUrl.search}${refUrl.hash}`, { replace: true });
          return;
        }
      } catch {
        // Ignore malformed referrer and use fallback route.
      }
    }
    navigate(fallbackPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8 md:py-10">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <article className="rounded-lg border bg-card px-5 py-6 shadow-sm md:px-8 md:py-8">
          <TermsDocument />
        </article>
      </div>
    </div>
  );
}
