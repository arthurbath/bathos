import { describe, expect, it } from 'vitest';

import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkKind,
  normalizeTaskPrimaryLink,
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
    expect(getTaskPrimaryLinkKind('https://example.test')).toBe('link');
    expect(getTaskPrimaryLinkKind('example.test')).toBe('link');
    expect(getTaskPrimaryLinkKind('')).toBeNull();
  });

  it('normalizes storage without inventing a protocol', () => {
    expect(normalizeTaskPrimaryLink('  example.test/read  ')).toBe('example.test/read');
    expect(normalizeTaskPrimaryLink('   ')).toBeNull();
    expect(normalizeTaskPrimaryLink(null)).toBeNull();
  });
});
