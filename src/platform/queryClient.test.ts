import { describe, expect, it } from 'vitest';
import { createBathOSQueryClient } from './queryClient';

describe('BathOS QueryClient retry ownership', () => {
  it('does not add an outer automatic retry around Supabase reads', () => {
    const client = createBathOSQueryClient();

    expect(client.getDefaultOptions().queries).toEqual(expect.objectContaining({
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    }));
  });
});
