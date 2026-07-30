export type ChecklistMultilinePastePlan = {
  titles: string[];
  finalCaretOffset: number;
};

export function normalizeClipboardLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function splitPlainTextTaskTitles(text: string): string[] {
  return normalizeClipboardLineBreaks(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function planChecklistMultilinePaste(
  title: string,
  selectionStart: number,
  selectionEnd: number,
  clipboardText: string,
): ChecklistMultilinePastePlan | null {
  const normalized = normalizeClipboardLineBreaks(clipboardText);
  const lines = normalized.split('\n');
  if (lines.length < 2) return null;

  const boundedStart = Math.max(0, Math.min(selectionStart, title.length));
  const boundedEnd = Math.max(boundedStart, Math.min(selectionEnd, title.length));
  const prefix = title.slice(0, boundedStart);
  const suffix = title.slice(boundedEnd);
  const lastLine = lines.at(-1) ?? '';

  return {
    titles: [
      `${prefix}${lines[0]}`,
      ...lines.slice(1, -1),
      `${lastLine}${suffix}`,
    ],
    finalCaretOffset: lastLine.length,
  };
}
