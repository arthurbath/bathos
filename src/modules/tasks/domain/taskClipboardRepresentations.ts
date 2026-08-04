export type TaskClipboardRepresentationKind = 'tasks' | 'checklist-items';

export type TaskClipboardRepresentations = {
  plainText: string;
  html: string;
  structuredText: string;
  mimeType: string;
  webMimeType: string;
};

export const TASK_CLIPBOARD_MIME_TYPE = 'application/vnd.garden.bath.tasks+json';
export const TASK_CLIPBOARD_WEB_MIME_TYPE = `web ${TASK_CLIPBOARD_MIME_TYPE}`;
export const TASK_CHECKLIST_CLIPBOARD_MIME_TYPE =
  'application/vnd.garden.bath.tasks.checklist+json';
export const TASK_CHECKLIST_CLIPBOARD_WEB_MIME_TYPE =
  `web ${TASK_CHECKLIST_CLIPBOARD_MIME_TYPE}`;

export function createTaskClipboardRepresentations(
  kind: TaskClipboardRepresentationKind,
  structuredText: string,
  labels: readonly string[],
): TaskClipboardRepresentations {
  const mimeType = clipboardMimeType(kind);
  const plainText = labels.map(normalizeClipboardLine).join('\n');
  const encodedPayload = encodeURIComponent(structuredText);
  const visibleHtml = labels
    .map((label) => `<div>${escapeHtml(normalizeClipboardLine(label))}</div>`)
    .join('');
  return {
    plainText,
    structuredText,
    mimeType,
    webMimeType: `web ${mimeType}`,
    html: [
      `<span hidden data-bathos-clipboard="${kind}"`,
      ` data-bathos-clipboard-payload="${encodedPayload}"></span>`,
      visibleHtml,
    ].join(''),
  };
}

export function readTaskClipboardStructuredText(
  clipboardData: Pick<DataTransfer, 'getData'> | null | undefined,
  kind: TaskClipboardRepresentationKind,
): string | null {
  if (!clipboardData) return null;
  const mimeType = clipboardMimeType(kind);
  const customText = safeClipboardRead(clipboardData, `web ${mimeType}`)
    || safeClipboardRead(clipboardData, mimeType);
  if (customText) return customText;

  const html = safeClipboardRead(clipboardData, 'text/html');
  if (!html || typeof DOMParser === 'undefined') return null;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const marker = document.querySelector<HTMLElement>(
    `[data-bathos-clipboard="${kind}"][data-bathos-clipboard-payload]`,
  );
  const encodedPayload = marker?.dataset.bathosClipboardPayload;
  if (!encodedPayload) return null;
  try {
    return decodeURIComponent(encodedPayload);
  } catch {
    return null;
  }
}

function clipboardMimeType(kind: TaskClipboardRepresentationKind): string {
  return kind === 'tasks'
    ? TASK_CLIPBOARD_MIME_TYPE
    : TASK_CHECKLIST_CLIPBOARD_MIME_TYPE;
}

function safeClipboardRead(
  clipboardData: Pick<DataTransfer, 'getData'>,
  type: string,
): string {
  try {
    return clipboardData.getData(type);
  } catch {
    return '';
  }
}

function normalizeClipboardLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
