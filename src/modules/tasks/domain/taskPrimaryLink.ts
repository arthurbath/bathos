export type TaskPrimaryLinkKind = 'mail' | 'link';
export type TaskPrimaryLinkIconKind = 'mail' | 'jira' | 'obsidian' | 'link';

const absolutePrimaryLinkPattern = /^(?:https?|message|jira|obsidian):/iu;
const jiraWebPathPattern = /^\/(?:browse|issues|jira|secure)(?:\/|$)/iu;

export function normalizeTaskPrimaryLink(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function getTaskPrimaryLinkKind(
  value: string | null | undefined,
): TaskPrimaryLinkKind | null {
  const normalized = normalizeTaskPrimaryLink(value);
  if (normalized === null) return null;
  return /^message:/iu.test(normalized) ? 'mail' : 'link';
}

export function getTaskPrimaryLinkHref(value: string | null | undefined): string | null {
  const normalized = normalizeTaskPrimaryLink(value);
  if (normalized === null) return null;
  if (absolutePrimaryLinkPattern.test(normalized)) return normalized;
  return `https://${normalized}`;
}

export function getTaskPrimaryLinkIconKind(
  value: string | null | undefined,
): TaskPrimaryLinkIconKind | null {
  const href = getTaskPrimaryLinkHref(value);
  if (href === null) return null;

  try {
    const url = new URL(href);
    const protocol = url.protocol.toLowerCase();
    if (protocol === 'message:') return 'mail';
    if (protocol === 'jira:') return 'jira';
    if (protocol === 'obsidian:') return 'obsidian';
    if (
      (protocol === 'http:' || protocol === 'https:')
      && isJiraWebUrl(url)
    ) {
      return 'jira';
    }
  } catch {
    return 'link';
  }

  return 'link';
}

export function taskPrimaryLinkOpensBrowserTab(
  value: string | null | undefined,
): boolean {
  const href = getTaskPrimaryLinkHref(value);
  if (href === null) return false;

  try {
    const protocol = new URL(href).protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isJiraWebUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'jira.com'
    || hostname.startsWith('jira.')
    || hostname.includes('.jira.')
  ) {
    return true;
  }

  return (
    (hostname === 'atlassian.net' || hostname.endsWith('.atlassian.net'))
    && jiraWebPathPattern.test(url.pathname)
  );
}
