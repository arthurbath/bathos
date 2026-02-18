import { useTermsConfirmation } from '@/hooks/useTermsConfirmation';
import { TermsUpdateOverlay } from '@/platform/components/TermsUpdateOverlay';
import { useToast } from '@/hooks/use-toast';

export default function TermsGate() {
  const { loading, needsConfirmation, latestVersion, pendingVersions, acceptTerms } = useTermsConfirmation();
  const { toast } = useToast();

  if (loading || !needsConfirmation) return null;

  const handleTermsAgree = async () => {
    await acceptTerms();
    toast({ title: 'Terms accepted' });
  };

  return (
    <TermsUpdateOverlay
      latestVersion={latestVersion}
      pendingVersions={pendingVersions}
      onAgree={handleTermsAgree}
    />
  );
}
