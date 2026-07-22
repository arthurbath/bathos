import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  TaskMarkdownNotes,
  TaskMarkdownPreview,
} from '@/modules/tasks/components/TaskMarkdownNotes';

const screenshotNotes = [
  'From: `jbenavides@usgbc.org`',
  'Subject: `Performance Certificate Audit Questions: August 7th`',
  'Date: `2026 Jul 22 6:42 AM`',
  'Destination: `Archive`',
  'message://%3CSJOPR22MB3781374037F4B820E86DD9AFC1C12%40example.com%3E',
  '',
  'Jeff Benavides shared *draft* audit questions for the **Arc Performance Certificate** work.',
  '',
  '* [Audit questions document](https://usgbc.sharepoint.com/:w:/s/GBCICertificationInternalTeam/very-long-destination)',
].join('\n');

describe('TaskMarkdownNotes', () => {
  it('renders the screenshot note shapes with safe actionable HTTP links', () => {
    const { container } = render(<TaskMarkdownPreview notes={screenshotNotes} />);

    expect(container.querySelectorAll('code')).toHaveLength(4);
    expect(container.querySelector('em')?.textContent).toBe('draft');
    expect(container.querySelector('strong')?.textContent).toBe('Arc Performance Certificate');
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(screen.getByText(/message:\/\//)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Audit questions document' });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/usgbc\.sharepoint\.com/);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('autolinks bare HTTP URLs without making disallowed protocols actionable', () => {
    render(<TaskMarkdownPreview notes={[
      'https://example.com/reading',
      '',
      '[Unsafe](javascript:alert(1))',
      '',
      '[Mail source](message://example)',
    ].join('\n')} />);

    expect(screen.getByRole('link', { name: 'https://example.com/reading' })).toBeTruthy();
    expect(screen.getByText('Unsafe').closest('a')).toBeNull();
    expect(screen.getByText('Mail source').closest('a')).toBeNull();
  });

  it('opens nonempty notes in preview and exposes auto-growing plain-text editing', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskMarkdownNotes id="notes" notes={screenshotNotes} disabled={false} onChange={onChange} />,
    );

    expect(screen.queryByRole('textbox', { name: 'Notes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Notes' }));
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea).toHaveValue(screenshotNotes);
    expect(textarea.className).toContain('overflow-hidden');
    expect(container.querySelector('textarea')?.style.height).not.toBe('');
  });

  it('opens empty notes directly in edit mode', () => {
    render(<TaskMarkdownNotes id="notes-empty" notes="" disabled={false} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Notes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Notes' })).toBeNull();
  });
});
