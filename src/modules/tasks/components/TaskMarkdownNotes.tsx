import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

type TaskMarkdownNotesProps = {
  id: string;
  notes: string;
  disabled: boolean;
  onChange: (notes: string) => void;
};

type TaskNoteSourceToken = {
  kind: 'plain' | 'emphasis' | 'strong' | 'code' | 'link';
  text: string;
  href?: string;
  label?: string;
};

type TaskNoteSourceLine = {
  source: string;
  headingIndicator: string | null;
  bulletIndicator: TaskNoteBulletIndicator | null;
  tokens: TaskNoteSourceToken[];
};

type SelectionOffsets = {
  start: number;
  end: number;
  direction?: 'forward' | 'backward';
};

type EditorHistory = {
  undo: string[];
  redo: string[];
};

type TaskNotePresentation = 'source' | 'semantic';
type TaskNoteBulletIndicator = '* ' | '- ';

const taskNoteTokenPattern = /(\[[^\]\n]+\]\([A-Za-z][A-Za-z0-9]*:\/\/[^)\s]+\)|https?:\/\/[^\s<]+|[A-Za-z][A-Za-z0-9]*:\/\/[^\s<]+|\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/giu;
const blockedTaskNoteSchemes = new Set(['javascript', 'data', 'vbscript']);
const noteLineClass = 'block min-h-6 whitespace-pre-wrap';
const headingLineClass = `${noteLineClass} text-lg font-semibold leading-7`;
const sourceBulletLineClass = `${noteLineClass} pl-[2ch] [text-indent:-2ch]`;
const semanticBulletLineClass = `${noteLineClass} pl-[0.75em] [text-indent:-0.75em]`;
const indicatorClass = 'font-mono text-muted-foreground';
const linkClass = 'break-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const bareLinkClass = `${linkClass} text-info`;
const codeClass = 'rounded bg-foreground/[0.08] px-1 py-0.5 font-mono text-[0.92em] text-foreground';

export function TaskMarkdownNotes({
  id,
  notes,
  disabled,
  onChange,
}: TaskMarkdownNotesProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const renderedValueRef = useRef<string | null>(null);
  const composingRef = useRef(false);
  const pointerSelectingRef = useRef(false);
  const historyRef = useRef<EditorHistory>({ undo: [], redo: [] });
  const sourceLineIndexesRef = useRef<Set<number>>(new Set());

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (
      editor === null
      || composingRef.current
      || renderedValueRef.current === notes
    ) {
      return;
    }
    if (renderedValueRef.current !== null) {
      historyRef.current = { undo: [], redo: [] };
    }
    const selection = document.activeElement === editor
      ? captureSelectionOffsets(editor)
      : null;
    const sourceLineIndexes = selection === null
      ? new Set<number>()
      : sourceLineIndexesForSelection(notes, selection);
    sourceLineIndexesRef.current = sourceLineIndexes;
    decorateTaskNotesEditor(editor, notes, sourceLineIndexes);
    renderedValueRef.current = notes;
    restoreSelectionOffsets(editor, selection);
  }, [notes]);

  useEffect(() => {
    const synchronizeSelectionPresentation = () => {
      if (composingRef.current || pointerSelectingRef.current) return;
      synchronizeTaskNotesSelectionPresentation(
        editorRef.current,
        sourceLineIndexesRef,
      );
    };
    const finishPointerSelection = () => {
      if (!pointerSelectingRef.current) return;
      pointerSelectingRef.current = false;
      synchronizeSelectionPresentation();
    };
    document.addEventListener('selectionchange', synchronizeSelectionPresentation);
    document.addEventListener('mouseup', finishPointerSelection, true);
    window.addEventListener('blur', finishPointerSelection);
    return () => {
      document.removeEventListener('selectionchange', synchronizeSelectionPresentation);
      document.removeEventListener('mouseup', finishPointerSelection, true);
      window.removeEventListener('blur', finishPointerSelection);
    };
  }, []);

  const synchronizeEditor = () => {
    const editor = editorRef.current;
    if (editor === null) return;
    const nextNotes = readTaskNotesEditor(editor);
    const selection = captureSelectionOffsets(editor);
    const sourceLineIndexes = selection === null
      ? new Set<number>()
      : sourceLineIndexesForSelection(nextNotes, selection);
    sourceLineIndexesRef.current = sourceLineIndexes;
    decorateTaskNotesEditor(editor, nextNotes, sourceLineIndexes);
    renderedValueRef.current = nextNotes;
    restoreSelectionOffsets(editor, selection);
    onChange(nextNotes);
  };

  const commitEditorValue = (
    currentNotes: string,
    nextNotes: string,
    selection: SelectionOffsets,
    recordHistory = true,
  ) => {
    const editor = editorRef.current;
    if (editor === null) return;
    if (recordHistory && currentNotes !== nextNotes) {
      const history = historyRef.current;
      if (history.undo.at(-1) !== currentNotes) history.undo.push(currentNotes);
      history.redo = [];
    }
    const sourceLineIndexes = sourceLineIndexesForSelection(nextNotes, selection);
    sourceLineIndexesRef.current = sourceLineIndexes;
    decorateTaskNotesEditor(editor, nextNotes, sourceLineIndexes);
    renderedValueRef.current = nextNotes;
    restoreSelectionOffsets(editor, selection);
    onChange(nextNotes);
  };

  const replaceCurrentSelection = (replacement: string) => {
    const editor = editorRef.current;
    if (editor === null) return;
    const selection = captureSelectionOffsets(editor);
    if (selection === null) return;
    const currentNotes = readTaskNotesEditor(editor);
    const nextNotes = currentNotes.slice(0, selection.start)
      + replacement
      + currentNotes.slice(selection.end);
    const caret = selection.start + replacement.length;
    commitEditorValue(currentNotes, nextNotes, { start: caret, end: caret });
  };

  const restoreHistoryValue = (direction: 'undo' | 'redo') => {
    const editor = editorRef.current;
    if (editor === null) return;
    const history = historyRef.current;
    const sourceStack = direction === 'undo' ? history.undo : history.redo;
    const target = sourceStack.pop();
    if (target === undefined) return;
    const currentNotes = readTaskNotesEditor(editor);
    const destinationStack = direction === 'undo' ? history.redo : history.undo;
    destinationStack.push(currentNotes);
    commitEditorValue(
      currentNotes,
      target,
      { start: target.length, end: target.length },
      false,
    );
  };

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const nextNotes = readTaskNotesEditor(event.currentTarget);
    if (composingRef.current) {
      renderedValueRef.current = nextNotes;
      onChange(nextNotes);
      return;
    }
    synchronizeEditor();
  };

  const handleBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const inputEvent = event.nativeEvent as InputEvent;
    if (composingRef.current || inputEvent.isComposing) return;
    const editor = event.currentTarget;
    const selection = captureSelectionOffsets(editor);
    if (selection === null) return;
    const currentNotes = readTaskNotesEditor(editor);
    let replacement: string | null = null;
    let selectionStart = selection.start;
    let selectionEnd = selection.end;

    if (inputEvent.inputType === 'insertText') {
      replacement = inputEvent.data ?? '';
    } else if (
      inputEvent.inputType === 'insertParagraph'
      || inputEvent.inputType === 'insertLineBreak'
    ) {
      const lineStart = currentNotes.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
      const bulletIndicator = taskNoteBulletIndicator(
        currentNotes.slice(lineStart, selection.start),
      );
      replacement = bulletIndicator === null ? '\n' : `\n${bulletIndicator}`;
    } else if (inputEvent.inputType === 'deleteContentBackward') {
      if (selectionStart === selectionEnd && selectionStart > 0) {
        selectionStart = previousCharacterOffset(currentNotes, selectionStart);
      }
      replacement = '';
    } else if (inputEvent.inputType === 'deleteContentForward') {
      if (selectionStart === selectionEnd && selectionEnd < currentNotes.length) {
        selectionEnd = nextCharacterOffset(currentNotes, selectionEnd);
      }
      replacement = '';
    } else if (inputEvent.inputType === 'historyUndo') {
      event.preventDefault();
      restoreHistoryValue('undo');
      return;
    } else if (inputEvent.inputType === 'historyRedo') {
      event.preventDefault();
      restoreHistoryValue('redo');
      return;
    } else {
      return;
    }

    event.preventDefault();
    const nextNotes = currentNotes.slice(0, selectionStart)
      + replacement
      + currentNotes.slice(selectionEnd);
    const caret = selectionStart + replacement.length;
    commitEditorValue(currentNotes, nextNotes, { start: caret, end: caret });
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (_event: CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    synchronizeEditor();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      (event.metaKey || event.ctrlKey)
      && event.key.toLowerCase() === 'z'
      && !event.altKey
    ) {
      event.preventDefault();
      restoreHistoryValue(event.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (
      event.key !== 'Enter'
      || event.shiftKey
      || event.metaKey
      || event.ctrlKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }
    const editor = event.currentTarget;
    const selection = captureSelectionOffsets(editor);
    if (selection === null) return;
    const source = readTaskNotesEditor(editor);
    const lineStart = source.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
    const bulletIndicator = taskNoteBulletIndicator(source.slice(lineStart));
    if (bulletIndicator === null) return;
    event.preventDefault();
    replaceCurrentSelection(`\n${bulletIndicator}`);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    replaceCurrentSelection(event.clipboardData.getData('text/plain'));
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = closestTaskNoteAnchor(event.target, event.currentTarget);
    if (anchor !== null && taskNoteAnchorShouldActivate(event.target, anchor)) {
      event.preventDefault();
      return;
    }
    if (event.button === 0) pointerSelectingRef.current = true;
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = closestTaskNoteAnchor(event.target, event.currentTarget);
    if (anchor === null) return;
    if (!taskNoteAnchorShouldActivate(event.target, anchor)) return;
    event.preventDefault();
    const href = anchor.getAttribute('href');
    if (!href) return;
    const targetName = /^https?:\/\//iu.test(href) ? '_blank' : '_self';
    window.open(href, targetName, 'noopener,noreferrer');
  };

  const handleBlur = () => {
    const editor = editorRef.current;
    if (editor === null || composingRef.current) return;
    const currentNotes = readTaskNotesEditor(editor);
    sourceLineIndexesRef.current = new Set();
    decorateTaskNotesEditor(editor, currentNotes);
    renderedValueRef.current = currentNotes;
  };

  return (
    <section aria-label="Task Notes">
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-label="Notes"
        aria-multiline="true"
        aria-disabled={disabled}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck
        data-empty={notes.length === 0 ? 'true' : 'false'}
        data-placeholder="Notes"
        onBeforeInput={handleBeforeInput}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className="min-h-16 w-full min-w-0 rounded-md border border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-sm leading-6 text-foreground [overflow-wrap:anywhere] focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 data-[empty=true]:before:pointer-events-none data-[empty=true]:before:text-muted-foreground data-[empty=true]:before:content-[attr(data-placeholder)]"
      />
    </section>
  );
}

export function TaskMarkdownPreview({ notes }: { notes: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
      {notes.split('\n').map((line, lineIndex) => {
        const parsed = tokenizeTaskNoteSourceLine(line);
        return (
          <span
            key={`${lineIndex}:${line}`}
            className={taskNoteLineClass(parsed, 'semantic')}
          >
            {renderTaskNoteSourceLine(parsed, 'semantic')}
          </span>
        );
      })}
    </div>
  );
}

function taskNoteLineClass(
  line: TaskNoteSourceLine,
  presentation: TaskNotePresentation,
): string {
  if (line.headingIndicator !== null) return headingLineClass;
  if (line.bulletIndicator !== null) {
    return presentation === 'source'
      ? sourceBulletLineClass
      : semanticBulletLineClass;
  }
  return noteLineClass;
}

function renderTaskNoteSourceLine(
  line: TaskNoteSourceLine,
  presentation: TaskNotePresentation,
): ReactNode {
  if (line.source.length === 0) return '\u00a0';
  return (
    <>
      {line.headingIndicator !== null ? (
        <span
          className={taskNoteIndicatorClass('heading', presentation)}
          data-task-markdown-indicator="heading"
        >
          {line.headingIndicator}
        </span>
      ) : null}
      {line.bulletIndicator !== null ? (
        <span
          className={taskNoteIndicatorClass('bullet', presentation)}
          data-task-markdown-indicator="bullet"
        >
          {line.bulletIndicator}
        </span>
      ) : null}
      {line.tokens.map((token, index) => renderTaskNoteToken(token, index, presentation))}
    </>
  );
}

function renderTaskNoteToken(
  token: TaskNoteSourceToken,
  index: number,
  presentation: TaskNotePresentation,
): ReactNode {
  const key = `${index}:${token.kind}:${token.text}`;
  if (token.kind === 'strong') {
    return (
      <strong key={key} className="font-semibold">
        <span
          className={taskNoteIndicatorClass('strong', presentation)}
          data-task-markdown-indicator="strong"
        >
          **
        </span>
        {token.text.slice(2, -2)}
        <span
          className={taskNoteIndicatorClass('strong', presentation)}
          data-task-markdown-indicator="strong"
        >
          **
        </span>
      </strong>
    );
  }
  if (token.kind === 'emphasis') {
    return (
      <em key={key} className="italic">
        <span
          className={taskNoteIndicatorClass('italic', presentation)}
          data-task-markdown-indicator="italic"
        >
          *
        </span>
        {token.text.slice(1, -1)}
        <span
          className={taskNoteIndicatorClass('italic', presentation)}
          data-task-markdown-indicator="italic"
        >
          *
        </span>
      </em>
    );
  }
  if (token.kind === 'code') {
    return (
      <code key={key} className={codeClass}>
        <span
          className={taskNoteIndicatorClass('code', presentation)}
          data-task-markdown-indicator="code"
        >
          `
        </span>
        {token.text.slice(1, -1)}
        <span
          className={taskNoteIndicatorClass('code', presentation)}
          data-task-markdown-indicator="code"
        >
          `
        </span>
      </code>
    );
  }
  if (token.kind === 'link' && token.href !== undefined) {
    const markdownLink = token.label !== undefined;
    const opensWebTab = /^https?:\/\//i.test(token.href);
    const sourceVisible = presentation === 'source';
    return (
      <a
        key={key}
        href={token.href}
        aria-label={markdownLink && !sourceVisible ? token.label : token.text}
        target={opensWebTab ? '_blank' : undefined}
        rel="noopener noreferrer"
        className={markdownLink && sourceVisible ? linkClass : bareLinkClass}
      >
        {markdownLink ? (
          <>
            <span
              className={taskNoteIndicatorClass('link', presentation)}
              data-task-markdown-indicator="link"
            >
              [
            </span>
            <span
              className={sourceVisible ? 'text-foreground' : 'text-info'}
              data-task-markdown-link-label
            >
              {token.label}
            </span>
            <span
              className={taskNoteIndicatorClass('link', presentation)}
              data-task-markdown-indicator="link"
            >
              ](
            </span>
            <span
              className={sourceVisible ? 'text-info' : 'text-[0px] leading-none'}
              data-task-markdown-link-destination
            >
              {token.href}
            </span>
            <span
              className={taskNoteIndicatorClass('link', presentation)}
              data-task-markdown-indicator="link"
            >
              )
            </span>
          </>
        ) : token.text}
      </a>
    );
  }
  return <span key={key}>{token.text}</span>;
}

function taskNoteAnchorShouldActivate(
  target: EventTarget | null,
  anchor: HTMLAnchorElement,
): boolean {
  const presentation = anchor.closest<HTMLElement>('[data-task-note-line]')
    ?.dataset.taskNotePresentation;
  if (presentation !== 'source') return true;
  if (!(target instanceof Element)) return false;
  const destination = target.closest('[data-task-markdown-link-destination]');
  if (destination !== null && anchor.contains(destination)) return true;
  return anchor.querySelector('[data-task-markdown-link-destination]') === null;
}

function tokenizeTaskNoteSourceLine(source: string): TaskNoteSourceLine {
  const headingMatch = source.match(/^(#{1,6} )/u);
  const headingIndicator = headingMatch?.[1] ?? null;
  const bulletIndicator = headingIndicator === null
    ? taskNoteBulletIndicator(source)
    : null;
  let cursor = headingIndicator?.length ?? bulletIndicator?.length ?? 0;
  const tokens: TaskNoteSourceToken[] = [];

  taskNoteTokenPattern.lastIndex = cursor;
  for (const match of source.matchAll(taskNoteTokenPattern)) {
    const start = match.index;
    if (start < cursor) continue;
    if (start > cursor) tokens.push({ kind: 'plain', text: source.slice(cursor, start) });

    const text = match[0];
    const markdownLink = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/u);
    const href = markdownLink?.[2]
      ?? (/^[A-Za-z][A-Za-z0-9]*:\/\//u.test(text) ? text : undefined);
    if (href !== undefined) {
      tokens.push(isSafeTaskNoteUrl(href)
        ? {
            kind: 'link',
            text,
            href,
            ...(markdownLink ? { label: markdownLink[1] } : {}),
          }
        : { kind: 'plain', text });
    } else if (text.startsWith('**')) {
      tokens.push({ kind: 'strong', text });
    } else if (text.startsWith('`')) {
      tokens.push({ kind: 'code', text });
    } else {
      tokens.push({ kind: 'emphasis', text });
    }
    cursor = start + text.length;
  }

  if (cursor < source.length) tokens.push({ kind: 'plain', text: source.slice(cursor) });
  return { source, headingIndicator, bulletIndicator, tokens };
}

function taskNoteBulletIndicator(source: string): TaskNoteBulletIndicator | null {
  if (source.startsWith('* ')) return '* ';
  if (source.startsWith('- ')) return '- ';
  return null;
}

function decorateTaskNotesEditor(
  editor: HTMLDivElement,
  notes: string,
  sourceLineIndexes: ReadonlySet<number> = new Set(),
): void {
  const fragment = document.createDocumentFragment();
  for (const [lineIndex, source] of (notes === '' ? [] : notes.split('\n')).entries()) {
    const parsed = tokenizeTaskNoteSourceLine(source);
    const line = document.createElement('div');
    line.dataset.taskNoteLine = '';
    const presentation = sourceLineIndexes.has(lineIndex) ? 'source' : 'semantic';
    line.dataset.taskNotePresentation = presentation;
    line.className = taskNoteLineClass(parsed, presentation);
    if (source === '') {
      line.append(document.createElement('br'));
    } else {
      appendTaskNoteLine(line, parsed, presentation);
    }
    fragment.append(line);
  }
  editor.replaceChildren(fragment);
  editor.dataset.empty = notes.length === 0 ? 'true' : 'false';
}

function appendTaskNoteLine(
  line: HTMLElement,
  parsed: TaskNoteSourceLine,
  presentation: TaskNotePresentation,
): void {
  if (parsed.headingIndicator !== null) {
    line.append(createIndicator(parsed.headingIndicator, 'heading', presentation));
  }
  if (parsed.bulletIndicator !== null) {
    line.append(createIndicator(parsed.bulletIndicator, 'bullet', presentation));
  }
  for (const token of parsed.tokens) line.append(createTaskNoteToken(token, presentation));
}

function createTaskNoteToken(
  token: TaskNoteSourceToken,
  presentation: TaskNotePresentation,
): Node {
  if (token.kind === 'plain') return document.createTextNode(token.text);
  if (token.kind === 'code') {
    const code = document.createElement('code');
    code.className = codeClass;
    code.append(
      createIndicator('`', 'code', presentation),
      document.createTextNode(token.text.slice(1, -1)),
      createIndicator('`', 'code', presentation),
    );
    return code;
  }
  if (token.kind === 'strong' || token.kind === 'emphasis') {
    const element = document.createElement(token.kind === 'strong' ? 'strong' : 'em');
    element.className = token.kind === 'strong' ? 'font-semibold' : 'italic';
    const marker = token.kind === 'strong' ? '**' : '*';
    element.append(
      createIndicator(
        marker,
        token.kind === 'strong' ? 'strong' : 'italic',
        presentation,
      ),
      document.createTextNode(token.text.slice(marker.length, -marker.length)),
      createIndicator(
        marker,
        token.kind === 'strong' ? 'strong' : 'italic',
        presentation,
      ),
    );
    return element;
  }
  if (token.kind === 'link' && token.href !== undefined) {
    const anchor = document.createElement('a');
    anchor.href = token.href;
    const sourceVisible = presentation === 'source';
    anchor.setAttribute(
      'aria-label',
      token.label !== undefined && !sourceVisible ? token.label : token.text,
    );
    anchor.rel = 'noopener noreferrer';
    anchor.className = token.label !== undefined && sourceVisible ? linkClass : bareLinkClass;
    if (/^https?:\/\//i.test(token.href)) anchor.target = '_blank';
    if (token.label !== undefined) {
      const label = document.createElement('span');
      label.className = sourceVisible ? 'text-foreground' : 'text-info';
      label.dataset.taskMarkdownLinkLabel = '';
      label.textContent = token.label;
      const destination = document.createElement('span');
      destination.className = sourceVisible ? 'text-info' : 'text-[0px] leading-none';
      destination.dataset.taskMarkdownLinkDestination = '';
      destination.textContent = token.href;
      anchor.append(
        createIndicator('[', 'link', presentation),
        label,
        createIndicator('](', 'link', presentation),
        destination,
        createIndicator(')', 'link', presentation),
      );
    } else {
      anchor.textContent = token.text;
    }
    return anchor;
  }
  return document.createTextNode(token.text);
}

function createIndicator(
  text: string,
  kind: string,
  presentation: TaskNotePresentation,
): HTMLSpanElement {
  const indicator = document.createElement('span');
  indicator.className = taskNoteIndicatorClass(kind, presentation);
  indicator.dataset.taskMarkdownIndicator = kind;
  indicator.textContent = text;
  return indicator;
}

function taskNoteIndicatorClass(
  kind: string,
  presentation: TaskNotePresentation,
): string {
  if (presentation === 'source') return indicatorClass;
  if (kind === 'bullet') {
    return `${indicatorClass} text-[0px] leading-none after:font-sans after:text-sm after:leading-6 after:text-foreground after:content-['•_']`;
  }
  return `${indicatorClass} text-[0px] leading-none`;
}

function readTaskNotesEditor(editor: HTMLElement): string {
  if (editor.childNodes.length === 0) return '';
  const lines = Array.from(editor.childNodes).map((node) => {
    if (node.nodeName === 'BR') return '';
    return (node.textContent ?? '').replaceAll('\u00a0', ' ');
  });
  return lines.join('\n').replaceAll('\r\n', '\n');
}

function synchronizeTaskNotesSelectionPresentation(
  editor: HTMLDivElement | null,
  sourceLineIndexesRef: { current: Set<number> },
): void {
  if (editor === null || document.activeElement !== editor) return;
  const selection = captureSelectionOffsets(editor);
  if (selection === null) return;
  const source = readTaskNotesEditor(editor);
  const sourceLineIndexes = sourceLineIndexesForSelection(source, selection);
  if (setsEqual(sourceLineIndexesRef.current, sourceLineIndexes)) return;
  sourceLineIndexesRef.current = sourceLineIndexes;
  decorateTaskNotesEditor(editor, source, sourceLineIndexes);
  restoreSelectionOffsets(editor, selection);
}

function sourceLineIndexesForSelection(
  source: string,
  selection: SelectionOffsets,
): Set<number> {
  if (source.length === 0) return new Set();
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  const firstLine = source.slice(0, Math.min(start, source.length)).split('\n').length - 1;
  const lastLine = source.slice(0, Math.min(end, source.length)).split('\n').length - 1;
  const indexes = new Set<number>();
  for (let index = firstLine; index <= lastLine; index += 1) indexes.add(index);
  return indexes;
}

function setsEqual(left: ReadonlySet<number>, right: ReadonlySet<number>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function closestTaskNoteAnchor(
  target: EventTarget | null,
  editor: HTMLElement,
): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  return anchor !== null && editor.contains(anchor) ? anchor : null;
}

function captureSelectionOffsets(editor: HTMLElement): SelectionOffsets | null {
  const selection = window.getSelection();
  if (
    selection === null
    || selection.rangeCount === 0
    || !selection.anchorNode
    || !selection.focusNode
    || !editor.contains(selection.anchorNode)
    || !editor.contains(selection.focusNode)
  ) {
    return null;
  }
  const anchor = endpointOffset(editor, selection.anchorNode, selection.anchorOffset);
  const focus = endpointOffset(editor, selection.focusNode, selection.focusOffset);
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
    direction: anchor > focus ? 'backward' : 'forward',
  };
}

function endpointOffset(editor: HTMLElement, node: Node, offset: number): number {
  if (editor.childNodes.length === 0) return 0;
  if (node === editor) {
    const childOffset = Math.min(offset, editor.childNodes.length);
    return Array.from(editor.childNodes)
      .slice(0, childOffset)
      .reduce((total, child, index) => (
        total + (child.textContent?.length ?? 0)
        + (index < childOffset - 1 || childOffset < editor.childNodes.length ? 1 : 0)
      ), 0);
  }
  let line = node;
  while (line.parentNode !== editor && line.parentNode !== null) line = line.parentNode;
  const lineIndex = Array.from<Node>(editor.childNodes).indexOf(line);
  if (lineIndex < 0) return 0;
  const prior = Array.from(editor.childNodes)
    .slice(0, lineIndex)
    .reduce((total, child) => total + (child.textContent?.length ?? 0) + 1, 0);
  const range = document.createRange();
  range.selectNodeContents(line);
  range.setEnd(node, offset);
  return prior + range.toString().length;
}

function restoreSelectionOffsets(
  editor: HTMLElement,
  offsets: SelectionOffsets | null,
): void {
  if (offsets === null || document.activeElement !== editor) return;
  const selection = window.getSelection();
  if (selection === null) return;
  const start = positionForOffset(editor, offsets.start);
  const end = positionForOffset(editor, offsets.end);
  if (typeof selection.setBaseAndExtent === 'function') {
    const anchor = offsets.direction === 'backward' ? end : start;
    const focus = offsets.direction === 'backward' ? start : end;
    selection.setBaseAndExtent(
      anchor.node,
      anchor.offset,
      focus.node,
      focus.offset,
    );
    return;
  }
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function positionForOffset(editor: HTMLElement, requestedOffset: number): {
  node: Node;
  offset: number;
} {
  if (editor.childNodes.length === 0) return { node: editor, offset: 0 };
  let remaining = Math.max(0, requestedOffset);
  const lines = Array.from(editor.childNodes);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const length = line.textContent?.length ?? 0;
    if (remaining <= length) return textPosition(line, remaining);
    remaining -= length;
    if (index < lines.length - 1) remaining = Math.max(0, remaining - 1);
  }
  return textPosition(lines.at(-1)!, lines.at(-1)?.textContent?.length ?? 0);
}

function textPosition(root: Node, requestedOffset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = requestedOffset;
  let textNode = walker.nextNode();
  while (textNode !== null) {
    const length = textNode.textContent?.length ?? 0;
    if (remaining <= length) return { node: textNode, offset: remaining };
    remaining -= length;
    textNode = walker.nextNode();
  }
  return { node: root, offset: root.childNodes.length };
}

function previousCharacterOffset(value: string, offset: number): number {
  const previous = Array.from(value.slice(0, offset)).at(-1);
  return Math.max(0, offset - (previous?.length ?? 1));
}

function nextCharacterOffset(value: string, offset: number): number {
  const next = Array.from(value.slice(offset))[0];
  return Math.min(value.length, offset + (next?.length ?? 1));
}

function isSafeTaskNoteUrl(value: string): boolean {
  const scheme = value.match(/^([A-Za-z][A-Za-z0-9]*):\/\//u)?.[1]?.toLowerCase();
  return scheme !== undefined && !blockedTaskNoteSchemes.has(scheme);
}
