export const TASK_CHECKLIST_CLIPBOARD_KIND =
  'garden.bath.tasks.checklist.clipboard';
export const TASK_CHECKLIST_CLIPBOARD_VERSION = 1;
export const TASK_CHECKLIST_CLIPBOARD_MAX_ITEMS = 500;
export const TASK_CHECKLIST_CLIPBOARD_MAX_BYTES = 1_000_000;

export type TaskChecklistClipboardItem = {
  title: string;
  completed: boolean;
};

export type TaskChecklistClipboardEnvelope = {
  kind: typeof TASK_CHECKLIST_CLIPBOARD_KIND;
  version: typeof TASK_CHECKLIST_CLIPBOARD_VERSION;
  operation: 'copy' | 'cut';
  items: TaskChecklistClipboardItem[];
};

export type ParsedTaskChecklistClipboard =
  | { kind: 'checklist-items'; envelope: TaskChecklistClipboardEnvelope }
  | { kind: 'text'; text: string }
  | { kind: 'invalid-checklist-payload'; reason: string }
  | { kind: 'empty' };

export function serializeTaskChecklistClipboard(
  operation: TaskChecklistClipboardEnvelope['operation'],
  items: readonly TaskChecklistClipboardItem[],
): string {
  const normalizedItems = items.map(parseChecklistItem);
  if (
    normalizedItems.length < 1
    || normalizedItems.length > TASK_CHECKLIST_CLIPBOARD_MAX_ITEMS
  ) {
    throw new Error(
      `Checklist clipboard requires 1-${TASK_CHECKLIST_CLIPBOARD_MAX_ITEMS} items`,
    );
  }
  const serialized = JSON.stringify({
    kind: TASK_CHECKLIST_CLIPBOARD_KIND,
    version: TASK_CHECKLIST_CLIPBOARD_VERSION,
    operation,
    items: normalizedItems,
  } satisfies TaskChecklistClipboardEnvelope);
  if (new TextEncoder().encode(serialized).byteLength > TASK_CHECKLIST_CLIPBOARD_MAX_BYTES) {
    throw new Error('Checklist clipboard payload is too large');
  }
  return serialized;
}

export function parseTaskChecklistClipboard(
  text: string,
): ParsedTaskChecklistClipboard {
  if (!text.trim()) return { kind: 'empty' };
  if (new TextEncoder().encode(text).byteLength > TASK_CHECKLIST_CLIPBOARD_MAX_BYTES) {
    return text.includes(TASK_CHECKLIST_CLIPBOARD_KIND)
      ? {
        kind: 'invalid-checklist-payload',
        reason: 'Checklist clipboard payload is too large',
      }
      : { kind: 'text', text };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'text', text };
  }
  if (!isRecord(value) || value.kind !== TASK_CHECKLIST_CLIPBOARD_KIND) {
    return { kind: 'text', text };
  }

  try {
    if (value.version !== TASK_CHECKLIST_CLIPBOARD_VERSION) {
      throw new Error('Checklist clipboard version is not supported');
    }
    if (value.operation !== 'copy' && value.operation !== 'cut') {
      throw new Error('Checklist clipboard operation is invalid');
    }
    if (
      !Array.isArray(value.items)
      || value.items.length < 1
      || value.items.length > TASK_CHECKLIST_CLIPBOARD_MAX_ITEMS
    ) {
      throw new Error('Checklist clipboard item count is invalid');
    }
    return {
      kind: 'checklist-items',
      envelope: {
        kind: TASK_CHECKLIST_CLIPBOARD_KIND,
        version: TASK_CHECKLIST_CLIPBOARD_VERSION,
        operation: value.operation,
        items: value.items.map(parseChecklistItem),
      },
    };
  } catch (error) {
    return {
      kind: 'invalid-checklist-payload',
      reason: error instanceof Error
        ? error.message
        : 'Checklist clipboard payload is invalid',
    };
  }
}

function parseChecklistItem(value: unknown): TaskChecklistClipboardItem {
  if (!isRecord(value)) throw new Error('Checklist clipboard item is invalid');
  if (
    typeof value.title !== 'string'
    || !value.title.trim()
    || value.title.length > 500
  ) {
    throw new Error('Checklist clipboard item title is invalid');
  }
  if (typeof value.completed !== 'boolean') {
    throw new Error('Checklist clipboard completion state is invalid');
  }
  return {
    title: value.title.trim(),
    completed: value.completed,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
