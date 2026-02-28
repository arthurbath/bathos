import { describe, expect, it } from 'vitest';
import { getUserDisplayName } from '@/platform/lib/getUserDisplayName';

type TestUser = NonNullable<Parameters<typeof getUserDisplayName>[0]>;

describe('getUserDisplayName', () => {
  it('prefers display_name from user metadata', () => {
    expect(
      getUserDisplayName({
        email: 'user@example.com',
        user_metadata: { display_name: 'Art' },
      } as TestUser),
    ).toBe('Art');
  });

  it('falls back to metadata name, then email, then You', () => {
    expect(
      getUserDisplayName({
        email: 'user@example.com',
        user_metadata: { name: 'Art Name' },
      } as TestUser),
    ).toBe('Art Name');

    expect(
      getUserDisplayName({
        email: 'user@example.com',
        user_metadata: {},
      } as TestUser),
    ).toBe('user@example.com');

    expect(
      getUserDisplayName({
        email: null,
        user_metadata: {},
      } as TestUser),
    ).toBe('You');
  });
});
