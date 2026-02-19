import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

function parseHashParams(hash: string): URLSearchParams {
  if (!hash || hash === '#') return new URLSearchParams();
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

function hasEmailChangeSignal(searchParams: URLSearchParams, hashParams: URLSearchParams, message: string): boolean {
  const type = hashParams.get('type') ?? searchParams.get('type');
  if (type === 'email_change') return true;

  return (
    message.includes('email') &&
    (message.includes('updated') || message.includes('changed') || message.includes('confirmed'))
  );
}

export default function AuthCallbackToasts() {
  const location = useLocation();
  const { toast } = useToast();
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    const key = `${location.pathname}${location.search}${location.hash}`;
    if (processedRef.current.has(key)) return;

    const searchParams = new URLSearchParams(location.search);
    const hashParams = parseHashParams(location.hash);

    if (searchParams.get('error') || hashParams.get('error')) return;

    const messageRaw = hashParams.get('message') ?? searchParams.get('message') ?? '';
    const message = messageRaw.toLowerCase();

    const isEmailChangeStepOne =
      message.includes('confirmation link accepted') &&
      message.includes('confirm link sent to the other email');

    const isEmailChangeCompleted =
      !isEmailChangeStepOne &&
      hasEmailChangeSignal(searchParams, hashParams, message);

    if (!isEmailChangeStepOne && !isEmailChangeCompleted) return;

    processedRef.current.add(key);

    if (isEmailChangeStepOne) {
      toast({
        title: 'Email change step 1 complete',
        description: 'First confirmation received. Confirm the link sent to the other email to finish.',
      });
      return;
    }

    toast({
      title: 'Email address changed',
      description: 'Step 2 complete. Your new email is now active.',
    });
  }, [location.hash, location.pathname, location.search, toast]);

  return null;
}
