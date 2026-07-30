import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  TaskMarkdownNotes,
  TaskMarkdownPreview,
} from '@/modules/tasks/components/TaskMarkdownNotes';

const supportedNotes = [
  '# Heading',
  '*italic* and **bold**',
  '* bullet point that can wrap',
  '[Link](https://example.com/reading)',
  '`inline code`',
].join('\n');

describe('TaskMarkdownNotes', () => {
  it('uses one directly editable surface without edit or preview modes', () => {
    const { container } = render(
      <TaskMarkdownNotes id="notes" notes={supportedNotes} disabled={false} onChange={vi.fn()} />,
    );

    const editor = screen.getByRole('textbox', { name: 'Notes' });
    expect(editor).toHaveAttribute('contenteditable', 'true');
    expect(editor).toHaveAttribute('aria-multiline', 'true');
    expect(editor.textContent).toBe(supportedNotes.replaceAll('\n', ''));
    expect(container.querySelector('textarea')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Notes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Preview Notes' })).toBeNull();
  });

  it('semantically presents supported Markdown while retaining exact source text', () => {
    const { container } = render(<TaskMarkdownPreview notes={supportedNotes} />);

    const heading = container.querySelector('[data-task-markdown-indicator="heading"]');
    expect(heading?.textContent).toBe('# ');
    expect(heading).toHaveClass('font-mono', 'text-muted-foreground', 'text-[0px]');
    expect(heading?.parentElement).toHaveClass('text-lg');

    expect(container.querySelector('em')?.textContent).toBe('*italic*');
    expect(container.querySelector('strong')?.textContent).toBe('**bold**');
    expect(container.querySelectorAll('[data-task-markdown-indicator="italic"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-task-markdown-indicator="strong"]')).toHaveLength(2);
    expect(container.querySelector('[data-task-markdown-indicator="bullet"]'))
      .toHaveClass(
        'font-mono',
        'text-muted-foreground',
        'text-[0px]',
        "after:content-['•_']",
      );
    expect(container.querySelector('[data-task-markdown-indicator="bullet"]')?.parentElement)
      .toHaveClass('pl-[0.75em]', '[text-indent:-0.75em]');

    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', 'https://example.com/reading');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveClass('break-all');
    expect(container.querySelectorAll('[data-task-markdown-indicator="link"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-task-markdown-indicator="link"]')[0])
      .toHaveClass('font-mono', 'text-muted-foreground', 'text-[0px]');
    expect(container.querySelector('[data-task-markdown-link-label]'))
      .toHaveClass('text-info');
    expect(container.querySelector('[data-task-markdown-link-label]'))
      .toHaveTextContent('Link');
    expect(container.querySelector('[data-task-markdown-link-destination]'))
      .toHaveClass('text-[0px]');
    expect(container.querySelector('[data-task-markdown-link-destination]'))
      .toHaveTextContent('https://example.com/reading');
    expect(link).toHaveClass('text-info');

    const code = container.querySelector('code');
    expect(code).toHaveTextContent('`inline code`');
    expect(code).toHaveClass('font-mono', 'bg-foreground/[0.08]');
    expect(code?.querySelectorAll('[data-task-markdown-indicator="code"]')).toHaveLength(2);
    expect(code?.querySelector('[data-task-markdown-indicator="code"]'))
      .toHaveClass('font-mono', 'text-muted-foreground', 'text-[0px]');
  });

  it('reveals raw Markdown only on the caret line and preserves source offsets', () => {
    const notes = [
      '# Heading',
      '[Link](https://example.test/read)',
      '**bold** and `code`',
    ].join('\n');
    const { container } = render(
      <TaskMarkdownNotes id="notes-lines" notes={notes} disabled={false} onChange={vi.fn()} />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    const lines = () => Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-note-line]'),
    );

    expect(lines().every((line) => line.dataset.taskNotePresentation === 'semantic')).toBe(true);
    editor.focus();
    const label = findTextNode(editor, 'Link');
    setCaret(label, 2);
    fireSelectionChange();

    expect(lines()[0]).toHaveAttribute('data-task-note-presentation', 'semantic');
    expect(lines()[1]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(lines()[2]).toHaveAttribute('data-task-note-presentation', 'semantic');
    expect(lines()[1].querySelector('[data-task-markdown-indicator="link"]'))
      .not.toHaveClass('text-[0px]');
    expect(lines()[1].querySelector('[data-task-markdown-link-label]'))
      .toHaveClass('text-foreground');
    expect(lines()[1].querySelector('[data-task-markdown-link-destination]'))
      .toHaveClass('text-info');
    expect(editor.textContent).toBe(notes.replaceAll('\n', ''));
    expect(window.getSelection()?.anchorNode?.textContent).toBe('Link');
    expect(window.getSelection()?.anchorOffset).toBe(2);

    const activeLabel = findTextNode(editor, 'Link');
    const bold = findTextNode(editor, 'bold');
    setSelection(activeLabel, 1, bold, 3);
    fireSelectionChange();
    expect(lines()[1]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(lines()[2]).toHaveAttribute('data-task-note-presentation', 'source');
  });

  it('preserves a backward cross-line selection while revealing its source lines', () => {
    const notes = [
      '# Heading',
      '[Link](https://example.test/read)',
      '**bold** and `code`',
    ].join('\n');
    const { container } = render(
      <TaskMarkdownNotes
        id="notes-backward-selection"
        notes={notes}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    editor.focus();
    setBackwardSelection(
      findTextNode(editor, 'bold'),
      3,
      findTextNode(editor, 'Link'),
      1,
    );

    fireSelectionChange();

    const lines = Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-note-line]'),
    );
    expect(lines[1]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(lines[2]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(window.getSelection()?.anchorNode?.textContent).toBe('bold');
    expect(window.getSelection()?.anchorOffset).toBe(3);
    expect(window.getSelection()?.focusNode?.textContent).toBe('Link');
    expect(window.getSelection()?.focusOffset).toBe(1);
  });

  it('keeps the DOM stable while a pointer selection extends backward', () => {
    const notes = [
      '# Heading',
      '[Link](https://example.test/read)',
      '**bold** and `code`',
    ].join('\n');
    const { container } = render(
      <TaskMarkdownNotes
        id="notes-backward-pointer-selection"
        notes={notes}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    const anchorNode = findTextNode(editor, 'bold');
    const focusNode = findTextNode(editor, 'Link');
    const originalLines = Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-note-line]'),
    );

    editor.focus();
    fireEvent.mouseDown(anchorNode.parentElement ?? editor, { button: 0 });
    setBackwardSelection(anchorNode, 3, focusNode, 1);
    fireSelectionChange();

    expect(anchorNode.isConnected).toBe(true);
    expect(focusNode.isConnected).toBe(true);
    expect(Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-note-line]'),
    )).toEqual(originalLines);
    expect(originalLines.every(
      (line) => line.dataset.taskNotePresentation === 'semantic',
    )).toBe(true);

    fireEvent.mouseUp(document, { button: 0 });

    const decoratedLines = Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-note-line]'),
    );
    expect(decoratedLines[1]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(decoratedLines[2]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(window.getSelection()?.anchorNode?.textContent).toBe('bold');
    expect(window.getSelection()?.anchorOffset).toBe(3);
    expect(window.getSelection()?.focusNode?.textContent).toBe('Link');
    expect(window.getSelection()?.focusOffset).toBe(1);
  });

  it('returns every line to semantic presentation when the editor loses focus', () => {
    const { container } = render(
      <TaskMarkdownNotes
        id="notes-blur"
        notes={'* first\n**second**'}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    editor.focus();
    setCaret(findTextNode(editor, 'first'), 2);
    fireSelectionChange();
    expect(container.querySelector('[data-task-note-presentation="source"]')).toBeTruthy();

    fireEvent.blur(editor);

    expect(container.querySelector('[data-task-note-presentation="source"]')).toBeNull();
    expect(container.querySelectorAll('[data-task-note-presentation="semantic"]')).toHaveLength(2);
  });

  it('applies Markdown styling as the user edits without changing the source', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskMarkdownNotes id="notes-live" notes="plain" disabled={false} onChange={onChange} />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });

    editor.replaceChildren(document.createTextNode('# Live\n**bold** and `code`'));
    fireEvent.input(editor);

    expect(onChange).toHaveBeenLastCalledWith('# Live\n**bold** and `code`');
    expect(container.querySelector('[data-task-markdown-indicator="heading"]')?.textContent).toBe('# ');
    expect(container.querySelector('strong')).toHaveTextContent('**bold**');
    expect(container.querySelector('code')).toHaveTextContent('`code`');
    expect(editor.textContent).toBe('# Live**bold** and `code`');
  });

  it('continues asterisk bullets on Enter and preserves the two-character hanging indent', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskMarkdownNotes id="notes-bullet" notes="* first" disabled={false} onChange={onChange} />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    editor.focus();
    placeCaretAtEnd(editor);

    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith('* first\n* ');
    expect(container.querySelectorAll('[data-task-markdown-indicator="bullet"]')).toHaveLength(2);
    expect(Array.from(editor.children)).toHaveLength(2);
    expect(editor.lastElementChild).toHaveClass('pl-[2ch]', '[text-indent:-2ch]');
  });

  it('uses a narrower hanging indent for inactive bullets than active source bullets', () => {
    const { container } = render(
      <TaskMarkdownNotes
        id="notes-bullet-presentations"
        notes={'* first bullet that can wrap\n* second bullet that can wrap'}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    const lines = () => Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-note-line]'),
    );

    expect(lines()[0]).toHaveClass('pl-[0.75em]', '[text-indent:-0.75em]');
    expect(lines()[1]).toHaveClass('pl-[0.75em]', '[text-indent:-0.75em]');

    editor.focus();
    setCaret(findTextNode(editor, 'second bullet that can wrap'), 3);
    fireSelectionChange();

    expect(lines()[0]).toHaveAttribute('data-task-note-presentation', 'semantic');
    expect(lines()[0]).toHaveClass('pl-[0.75em]', '[text-indent:-0.75em]');
    expect(lines()[0]).not.toHaveClass('pl-[2ch]', '[text-indent:-2ch]');
    expect(lines()[1]).toHaveAttribute('data-task-note-presentation', 'source');
    expect(lines()[1]).toHaveClass('pl-[2ch]', '[text-indent:-2ch]');
    expect(lines()[1]).not.toHaveClass('pl-[0.75em]', '[text-indent:-0.75em]');
  });

  it('preserves the caret while retokenizing and inserts pasted content as plain text', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskMarkdownNotes id="notes-caret" notes="**bold**" disabled={false} onChange={onChange} />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    editor.focus();
    const boldText = findTextNode(editor, 'bold');
    boldText.insertData(2, 'x');
    setCaret(boldText, 3);
    fireEvent.input(editor);

    expect(onChange).toHaveBeenLastCalledWith('**boxld**');
    expect(window.getSelection()?.anchorNode?.textContent).toBe('boxld');
    expect(window.getSelection()?.anchorOffset).toBe(3);

    placeCaretAtEnd(editor);
    fireEvent.paste(editor, {
      clipboardData: { getData: () => ' `pasted`' },
    });
    expect(onChange).toHaveBeenLastCalledWith('**boxld** `pasted`');
    expect(container.querySelector('code')).toHaveTextContent('`pasted`');
  });

  it('replaces a selected styled range cleanly and keeps undo local to notes', () => {
    const onChange = vi.fn();
    render(
      <TaskMarkdownNotes
        id="notes-replace"
        notes={'* first\n* second'}
        disabled={false}
        onChange={onChange}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    editor.focus();
    selectContents(editor);

    fireEvent.paste(editor, {
      clipboardData: { getData: () => '# Replacement' },
    });

    expect(onChange).toHaveBeenLastCalledWith('# Replacement');
    expect(editor.children).toHaveLength(1);
    expect(editor.querySelector('[data-task-markdown-indicator="heading"]')?.textContent).toBe('# ');

    fireEvent.keyDown(editor, { key: 'z', metaKey: true });
    expect(onChange).toHaveBeenLastCalledWith('* first\n* second');
    expect(editor.querySelectorAll('[data-task-markdown-indicator="bullet"]')).toHaveLength(2);
  });

  it('keeps safe bare links actionable and treats unsupported or executable syntax as text', () => {
    const { container } = render(<TaskMarkdownPreview notes={[
      'https://example.com/reading',
      'message://example',
      '[Unsafe](javascript://alert)',
      '~~strike~~ _underscore_ > quote',
    ].join('\n')} />);

    expect(screen.getByRole('link', { name: 'https://example.com/reading' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'message://example' })).toBeTruthy();
    expect(screen.getByText('[Unsafe](javascript://alert)').closest('a')).toBeNull();
    expect(container.querySelector('del')).toBeNull();
    expect(container.textContent).toContain('~~strike~~ _underscore_ > quote');
  });

  it('explicitly opens a decorated link from the editable surface without hover underlining', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { container } = render(
      <TaskMarkdownNotes
        id="notes-links"
        notes={'https://example.test/read\nmessage://synthetic-message'}
        disabled={false}
        onChange={vi.fn()}
      />,
    );

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveClass('break-all');
    expect(links[0]).toHaveClass('cursor-pointer');
    expect(links[0]).toHaveClass('text-info');
    expect(links[0].className).not.toContain('hover:underline');

    fireEvent.click(links[0]);
    expect(open).toHaveBeenCalledWith(
      'https://example.test/read',
      '_blank',
      'noopener,noreferrer',
    );
    fireEvent.click(links[1]);
    expect(open).toHaveBeenCalledWith(
      'message://synthetic-message',
      '_self',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });

  it('switches a Markdown link between semantic navigation and active-line source editing', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { container } = render(
      <TaskMarkdownNotes
        id="notes-markdown-link"
        notes="[Take the survey](https://example.test/survey)"
        disabled={false}
        onChange={vi.fn()}
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveClass('text-info');
    expect(link.textContent).toBe('[Take the survey](https://example.test/survey)');
    expect(container.querySelector('[data-task-markdown-link-label]'))
      .toHaveClass('text-info');
    expect(container.querySelector('[data-task-markdown-link-destination]'))
      .toHaveClass('text-[0px]');
    for (const indicator of container.querySelectorAll('[data-task-markdown-indicator="link"]')) {
      expect(indicator).toHaveClass('font-mono', 'text-muted-foreground', 'text-[0px]');
    }

    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith(
      'https://example.test/survey',
      '_blank',
      'noopener,noreferrer',
    );

    const editor = screen.getByRole('textbox', { name: 'Notes' });
    editor.focus();
    setCaret(findTextNode(editor, 'Take the survey'), 4);
    fireSelectionChange();

    const activeLink = screen.getByRole('link', {
      name: '[Take the survey](https://example.test/survey)',
    });
    expect(activeLink).not.toHaveClass('text-info');
    expect(container.querySelector('[data-task-markdown-link-label]'))
      .toHaveClass('text-foreground');
    expect(container.querySelector('[data-task-markdown-link-destination]'))
      .toHaveClass('text-info');
    fireEvent.click(activeLink);
    expect(open).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });

  it('uses the same live editor for empty and disabled notes', () => {
    const { rerender } = render(
      <TaskMarkdownNotes id="notes-empty" notes="" disabled={false} onChange={vi.fn()} />,
    );
    const editor = screen.getByRole('textbox', { name: 'Notes' });
    expect(editor).toHaveAttribute('data-empty', 'true');
    expect(editor).toHaveAttribute('data-placeholder', 'Notes');

    rerender(<TaskMarkdownNotes id="notes-empty" notes="" disabled onChange={vi.fn()} />);
    expect(editor).toHaveAttribute('contenteditable', 'false');
    expect(editor).toHaveAttribute('aria-disabled', 'true');
  });
});

function placeCaretAtEnd(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function setCaret(node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function setSelection(
  startNode: Node,
  startOffset: number,
  endNode: Node,
  endOffset: number,
): void {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function setBackwardSelection(
  anchorNode: Node,
  anchorOffset: number,
  focusNode: Node,
  focusOffset: number,
): void {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.setBaseAndExtent(
    anchorNode,
    anchorOffset,
    focusNode,
    focusOffset,
  );
}

function fireSelectionChange(): void {
  document.dispatchEvent(new Event('selectionchange'));
}

function selectContents(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function findTextNode(element: HTMLElement, text: string): Text {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node !== null) {
    if (node.textContent === text) return node as Text;
    node = walker.nextNode();
  }
  throw new Error(`Could not find text node ${text}`);
}
