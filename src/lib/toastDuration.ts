import { isValidElement, type ReactNode } from "react";

export const TOAST_APPROXIMATE_CHARACTERS_PER_LINE = 42;
export const TOAST_BASE_DURATION_MS = 2_000;
export const TOAST_ADDITIONAL_LINE_DURATION_MS = 1_500;

export type ToastDurationContent = ReactNode | (() => ReactNode);

function getToastTextContent(content: ToastDurationContent): string {
  if (content === null || content === undefined || typeof content === "boolean") {
    return "";
  }

  if (typeof content === "function") {
    return getToastTextContent(content());
  }

  if (typeof content === "string" || typeof content === "number") {
    return String(content);
  }

  if (Array.isArray(content)) {
    return content.map(getToastTextContent).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(content)) {
    if (content.type === "br") return "\n";
    return getToastTextContent(content.props.children);
  }

  return "";
}

export function estimateToastTextLines(content: ToastDurationContent): number {
  const text = getToastTextContent(content);
  if (!text) return 0;

  return text.split(/\r\n?|\n/).reduce((lineCount, explicitLine) => {
    const estimatedWrappedLines = Math.max(
      1,
      Math.ceil(explicitLine.length / TOAST_APPROXIMATE_CHARACTERS_PER_LINE),
    );
    return lineCount + estimatedWrappedLines;
  }, 0);
}

export function getToastDurationMs(
  title?: ToastDurationContent,
  description?: ToastDurationContent,
): number {
  const estimatedLines = estimateToastTextLines(title) + estimateToastTextLines(description);
  const additionalLines = Math.max(0, estimatedLines - 1);
  return TOAST_BASE_DURATION_MS + additionalLines * TOAST_ADDITIONAL_LINE_DURATION_MS;
}
