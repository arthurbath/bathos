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

  it('styles the approved source subset while keeping fixed-width indicators visible', () => {
    const { container } = render(<TaskMarkdownPreview notes={supportedNotes} />);

    const heading = container.querySelector('[data-task-markdown-indicator="heading"]');
    expect(heading?.textContent).toBe('# ');
    expect(heading).toHaveClass('font-mono');
    expect(heading?.parentElement).toHaveClass('text-lg');

    expect(container.querySelector('em')?.textContent).toBe('*italic*');
    expect(container.querySelector('strong')?.textContent).toBe('**bold**');
    expect(container.querySelectorAll('[data-task-markdown-indicator="italic"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-task-markdown-indicator="strong"]')).toHaveLength(2);
    expect(container.querySelector('[data-task-markdown-indicator="bullet"]')).toHaveClass('font-mono');
    expect(container.querySelector('[data-task-markdown-indicator="bullet"]')?.parentElement)
      .toHaveClass('pl-[2ch]', '[text-indent:-2ch]');

    const link = screen.getByRole('link', { name: '[Link](https://example.com/reading)' });
    expect(link).toHaveAttribute('href', 'https://example.com/reading');
    expect(link).toHaveAttribute('target', '_blank');
    expect(container.querySelectorAll('[data-task-markdown-indicator="link"]')).toHaveLength(3);

    const code = container.querySelector('code');
    expect(code).toHaveTextContent('`inline code`');
    expect(code).toHaveClass('font-mono', 'bg-foreground/[0.08]');
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
    expect(links[0]).toHaveClass('cursor-pointer');
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
