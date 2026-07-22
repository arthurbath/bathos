import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type TaskMarkdownNotesProps = {
  id: string;
  notes: string;
  disabled: boolean;
  onChange: (notes: string) => void;
};

export function TaskMarkdownNotes({
  id,
  notes,
  disabled,
  onChange,
}: TaskMarkdownNotesProps) {
  const [editing, setEditing] = useState(() => notes.trim() === '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || textareaRef.current === null) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [editing, notes]);

  if (!editing && notes.trim() !== '') {
    return (
      <section className="space-y-2" aria-label="Task Notes">
        <TaskMarkdownPreview notes={notes} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setEditing(true)}
        >
          Edit Notes
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-2" aria-label="Edit Task Notes">
      <label className="sr-only" htmlFor={id}>Notes</label>
      <Textarea
        ref={textareaRef}
        id={id}
        value={notes}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Notes"
        className="min-h-28 resize-none overflow-hidden"
      />
      {notes.trim() !== '' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setEditing(false)}
        >
          Preview Notes
        </Button>
      ) : null}
    </section>
  );
}

export function TaskMarkdownPreview({ notes }: { notes: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => isSafeTaskNoteUrl(url) ? url : ''}
        components={{
          p: ({ children }) => (
            <p className="mb-3 whitespace-pre-wrap last:mb-0">{children}</p>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-foreground/[0.08] px-1 py-0.5 font-mono text-[0.92em] text-foreground">
              {children}
            </code>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-2 pl-6 last:mb-0">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="min-w-0 pl-1 marker:text-muted-foreground">{children}</li>
          ),
          a: ({ href, children }) => isSafeTaskNoteUrl(href) ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {children}
            </a>
          ) : <span>{children}</span>,
        }}
      >
        {notes}
      </ReactMarkdown>
    </div>
  );
}

function isSafeTaskNoteUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}
