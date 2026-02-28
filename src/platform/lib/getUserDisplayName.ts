import type { User } from '@supabase/supabase-js';

type UserWithNameData = Pick<User, 'email' | 'user_metadata'>;

function getTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getUserDisplayName(user: UserWithNameData | null | undefined): string {
  if (!user) return 'You';

  const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
  const metadataDisplayName = getTrimmedString(metadata?.display_name);
  if (metadataDisplayName) return metadataDisplayName;

  const metadataName = getTrimmedString(metadata?.name);
  if (metadataName) return metadataName;

  const email = getTrimmedString(user.email);
  if (email) return email;

  return 'You';
}
