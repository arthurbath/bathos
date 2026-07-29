import { describe, expect, it } from 'vitest';

import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkIconKind,
  getTaskPrimaryLinkKind,
  normalizeTaskPrimaryLink,
  taskPrimaryLinkOpensBrowserTab,
} from '@/modules/tasks/domain/taskPrimaryLink';

describe('task Primary Link', () => {
  it('preserves explicit web and Mail destinations', () => {
    expect(getTaskPrimaryLinkHref('https://example.test/read')).toBe(
      'https://example.test/read',
    );
    expect(getTaskPrimaryLinkHref('http://example.test/read')).toBe(
      'http://example.test/read',
    );
    expect(getTaskPrimaryLinkHref('message://synthetic-message')).toBe(
      'message://synthetic-message',
    );
    expect(getTaskPrimaryLinkHref('jira://issue/PF-766')).toBe(
      'jira://issue/PF-766',
    );
    expect(getTaskPrimaryLinkHref('obsidian://open?vault=Personal')).toBe(
      'obsidian://open?vault=Personal',
    );
  });

  it('treats another nonblank value as an HTTPS browser destination', () => {
    expect(getTaskPrimaryLinkHref('example.test/read')).toBe(
      'https://example.test/read',
    );
    expect(getTaskPrimaryLinkHref('  example.test/read  ')).toBe(
      'https://example.test/read',
    );
  });

  it('derives Mail or Link iconography from the editable value', () => {
    expect(getTaskPrimaryLinkKind('message://synthetic-message')).toBe('mail');
    expect(getTaskPrimaryLinkKind('jira://issue/PF-766')).toBe('link');
    expect(getTaskPrimaryLinkKind('obsidian://open?vault=Personal')).toBe('link');
    expect(getTaskPrimaryLinkKind('https://example.test')).toBe('link');
    expect(getTaskPrimaryLinkKind('example.test')).toBe('link');
    expect(getTaskPrimaryLinkKind('')).toBeNull();
  });

  it('identifies protocol-specific iconography without changing link transport', () => {
    expect(getTaskPrimaryLinkIconKind('message://synthetic-message')).toBe('mail');
    expect(getTaskPrimaryLinkIconKind('jira://issue/PF-766')).toBe('jira');
    expect(getTaskPrimaryLinkIconKind('obsidian://open?vault=Personal')).toBe('obsidian');
    expect(getTaskPrimaryLinkIconKind('https://usgbc.atlassian.net/browse/PF-766'))
      .toBe('jira');
    expect(getTaskPrimaryLinkIconKind(
      'https://usgbc.atlassian.net/jira/software/c/projects/PF/boards/1',
    )).toBe('jira');
    expect(getTaskPrimaryLinkIconKind('https://usgbc.atlassian.net/wiki/spaces/PF'))
      .toBe('link');
    expect(getTaskPrimaryLinkIconKind('https://example.test')).toBe('link');
    expect(getTaskPrimaryLinkIconKind('')).toBeNull();
  });

  it('opens only web links in a separate browser context', () => {
    expect(taskPrimaryLinkOpensBrowserTab('https://usgbc.atlassian.net/browse/PF-766'))
      .toBe(true);
    expect(taskPrimaryLinkOpensBrowserTab('example.test/read')).toBe(true);
    expect(taskPrimaryLinkOpensBrowserTab('message://synthetic-message')).toBe(false);
    expect(taskPrimaryLinkOpensBrowserTab('jira://issue/PF-766')).toBe(false);
    expect(taskPrimaryLinkOpensBrowserTab('obsidian://open?vault=Personal')).toBe(false);
  });

  it('normalizes storage without inventing a protocol', () => {
    expect(normalizeTaskPrimaryLink('  example.test/read  ')).toBe('example.test/read');
    expect(normalizeTaskPrimaryLink('   ')).toBeNull();
    expect(normalizeTaskPrimaryLink(null)).toBeNull();
  });
});
