import { useEffect, useMemo, useRef, type UIEvent } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownSyntaxTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

type InlineSegment = {
  text: string;
  className?: string;
};

const INLINE_PATTERN = /(`[^`\n]+`|!?\[[^\]\n]*\]\([^) \n]+(?:\s+"[^"]*")?\)|(\*\*|__)[^*_]+?\2|(\*|_)[^*_]+?\3)/g;

function inlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const matchedText = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index) });
    }

    let className = 'text-warning';
    if (matchedText.startsWith('`')) className = 'text-success';
    if (matchedText.startsWith('[') || matchedText.startsWith('![')) className = 'text-info';
    if (matchedText.startsWith('**') || matchedText.startsWith('__')) className = 'text-primary';
    if (
      (matchedText.startsWith('*') && !matchedText.startsWith('**'))
      || (matchedText.startsWith('_') && !matchedText.startsWith('__'))
    ) {
      className = 'text-primary';
    }

    segments.push({ text: matchedText, className });
    lastIndex = index + matchedText.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}

function renderInline(text: string, keyPrefix: string) {
  return inlineSegments(text).map((segment, index) => (
    <span key={`${keyPrefix}-${index}`} className={segment.className}>{segment.text}</span>
  ));
}

function renderHighlightedMarkdown(value: string) {
  const lines = value.split('\n');
  let inFence = false;

  return lines.map((line, index) => {
    const key = `line-${index}`;
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      inFence = !inFence;
      return (
        <span key={key} className="text-success">
          {line}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    if (inFence) {
      return (
        <span key={key} className="text-success">
          {line}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const headingMatch = line.match(/^(#{1,6})(\s+.*)?$/);
    if (headingMatch) {
      return (
        <span key={key}>
          <span className="text-admin">{headingMatch[1]}</span>
          <span className="text-primary">{headingMatch[2] ?? ''}</span>
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const blockquoteMatch = line.match(/^(>\s?)(.*)$/);
    if (blockquoteMatch) {
      return (
        <span key={key}>
          <span className="text-warning">{blockquoteMatch[1]}</span>
          <span className="text-muted-foreground">{renderInline(blockquoteMatch[2], key)}</span>
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const taskListMatch = line.match(/^(\s*)([-+*])(\s+\[[ xX]\])(\s+)(.*)$/);
    if (taskListMatch) {
      return (
        <span key={key}>
          {taskListMatch[1]}
          <span className="text-warning">{taskListMatch[2]}</span>
          <span className="text-info">{taskListMatch[3]}</span>
          {taskListMatch[4]}
          {renderInline(taskListMatch[5], key)}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const unorderedMatch = line.match(/^(\s*)([-+*])(\s+)(.*)$/);
    if (unorderedMatch) {
      return (
        <span key={key}>
          {unorderedMatch[1]}
          <span className="text-warning">{unorderedMatch[2]}</span>
          {unorderedMatch[3]}
          {renderInline(unorderedMatch[4], key)}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const orderedMatch = line.match(/^(\s*)(\d+\.)(\s+)(.*)$/);
    if (orderedMatch) {
      return (
        <span key={key}>
          {orderedMatch[1]}
          <span className="text-warning">{orderedMatch[2]}</span>
          {orderedMatch[3]}
          {renderInline(orderedMatch[4], key)}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const horizontalRuleMatch = line.match(/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/);
    if (horizontalRuleMatch) {
      return (
        <span key={key} className="text-muted-foreground">
          {line}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    if (line.includes('|')) {
      const parts = line.split(/(\|)/);
      return (
        <span key={key}>
          {parts.map((part, partIndex) => (
            <span key={`${key}-table-${partIndex}`} className={part === '|' ? 'text-info' : undefined}>
              {renderInline(part, `${key}-table-${partIndex}`)}
            </span>
          ))}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    return (
      <span key={key}>
        {renderInline(line, key)}
        {index < lines.length - 1 ? '\n' : ''}
      </span>
    );
  });
}

export function MarkdownSyntaxTextarea({
  id,
  value,
  onChange,
  className,
  disabled,
  autoFocus,
}: MarkdownSyntaxTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const highlighted = useMemo(() => renderHighlightedMarkdown(value || ' '), [value]);

  useEffect(() => {
    if (!highlightRef.current || !textareaRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, [highlighted]);

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div
      className={cn(
        'relative h-[45vh] min-h-[45vh] overflow-hidden rounded-md border border-[hsl(var(--grid-sticky-line))] bg-background font-mono text-xs leading-5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/65',
        className,
      )}
    >
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-0 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-foreground [scrollbar-gutter:stable] [tab-size:4]"
      >
        {highlighted}
        {'\n'}
      </pre>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        disabled={disabled}
        autoFocus={autoFocus}
        spellCheck={false}
        wrap="soft"
        className="absolute inset-0 h-full w-full resize-none overflow-auto rounded-md border-0 bg-transparent px-3 py-2 text-transparent caret-foreground outline-none selection:bg-info/35 [overflow-wrap:break-word] [scrollbar-gutter:stable] [tab-size:4] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ WebkitTextFillColor: 'transparent', font: 'inherit', lineHeight: 'inherit' }}
      />
    </div>
  );
}
