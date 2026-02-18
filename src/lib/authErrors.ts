export const WEAK_PASSWORD_MESSAGE =
  'This password is too weak or has appeared in known data breaches. Please choose a stronger, unique password.';

export function isWeakOrLeakedPasswordError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { message?: string; code?: string; name?: string };
  const message = (maybeError.message ?? '').toLowerCase();
  const code = (maybeError.code ?? '').toLowerCase();
  const name = (maybeError.name ?? '').toLowerCase();

  if (code.includes('weak_password')) return true;
  if (name.includes('weak_password')) return true;

  return (
    message.includes('weak password') ||
    message.includes('password is too weak') ||
    message.includes('compromised') ||
    message.includes('breach') ||
    message.includes('breached') ||
    message.includes('leaked') ||
    message.includes('pwned') ||
    message.includes('haveibeenpwned')
  );
}
