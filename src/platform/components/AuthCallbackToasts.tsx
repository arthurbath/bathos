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

/** Map Supabase error_code values to friendly toast content. */
function getErrorToast(errorCode: string, errorDescription: string): { title: string; description: string } | null {
  const desc = decodeURIComponent(errorDescription.replace(/\+/g, ' ')).trim();

  switch (errorCode) {
    case 'otp_expired':
      return {
        title: 'Link Expired',
        description: 'This link is no longer valid. It may have already been used or has expired. Please request a new one.',
      };
    case 'otp_disabled':
      return {
        title: 'Link Disabled',
        description: 'This type of link is not currently enabled. Please contact support.',
      };
    case 'validation_failed':
      return {
        title: 'Validation Failed',
        description: desc || 'The request could not be validated. Please try again.',
      };
    case 'user_not_found':
      return {
        title: 'Account Not Found',
        description: 'No account was found for this link. It may have been deleted.',
      };
    case 'user_banned':
      return {
        title: 'Account Suspended',
        description: 'This account has been suspended. Please contact support.',
      };
    case 'flow_state_not_found':
    case 'flow_state_expired':
      return {
        title: 'Session Expired',
        description: 'The authentication session for this link has expired. Please start over.',
      };
    case 'provider_disabled':
      return {
        title: 'Sign-In Method Unavailable',
        description: 'This sign-in method is not currently available.',
      };
    default:
      break;
  }

  // Fallback: match on error (e.g. "access_denied") or use the raw description
  if (desc) {
    return {
      title: 'Authentication Error',
      description: desc,
    };
  }

  return null;
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

    // --- Handle auth errors ---
    const error = hashParams.get('error') ?? searchParams.get('error');
    if (error) {
      const errorCode = hashParams.get('error_code') ?? searchParams.get('error_code') ?? '';
      const errorDescription = hashParams.get('error_description') ?? searchParams.get('error_description') ?? '';

      const errorToast = getErrorToast(errorCode, errorDescription);
      if (errorToast) {
        processedRef.current.add(key);
        toast({ title: errorToast.title, description: errorToast.description, variant: 'destructive' });
      }
      return;
    }

    // --- Handle success messages ---
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
        title: 'Email Change Step 1 Complete',
        description: 'First confirmation received. Confirm the link sent to the other email to finish.',
      });
      return;
    }

    toast({
      title: 'Email Address Changed',
      description: 'Step 2 complete. Your new email is now active.',
    });
  }, [location.hash, location.pathname, location.search, toast]);

  return null;
}
