export type TaskPrimaryLinkKind = 'mail' | 'link';

export function normalizeTaskPrimaryLink(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function getTaskPrimaryLinkKind(
  value: string | null | undefined,
): TaskPrimaryLinkKind | null {
  const normalized = normalizeTaskPrimaryLink(value);
  if (normalized === null) return null;
  return /^message:\/\//iu.test(normalized) ? 'mail' : 'link';
}

export function getTaskPrimaryLinkHref(value: string | null | undefined): string | null {
  const normalized = normalizeTaskPrimaryLink(value);
  if (normalized === null) return null;
  if (/^(?:https?|message):\/\//iu.test(normalized)) return normalized;
  return `https://${normalized}`;
}
