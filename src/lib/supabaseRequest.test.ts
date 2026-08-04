import { describe, expect, it, vi } from 'vitest';
import { supabaseRequest } from './supabaseRequest';

describe('supabaseRequest retry ownership', () => {
  it('returns successful result data without another wrapper layer', async () => {
    const operation = vi.fn(async () => ({ data: { id: 'row-1' }, error: null }));

    await expect(supabaseRequest(operation)).resolves.toEqual({ id: 'row-1' });
    expect(operation).toHaveBeenCalledOnce();
  });

  it('does not replay a resolved transient PostgREST error', async () => {
    const error = {
      code: '503',
      message: 'Service unavailable',
      details: '',
      hint: '',
      name: 'PostgrestError',
    };
    const operation = vi.fn(async () => ({ data: null, error }));

    await expect(supabaseRequest(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('does not replay a thrown ambiguous network failure', async () => {
    const failure = new TypeError('Failed to fetch');
    const operation = vi.fn(async () => {
      throw failure;
    });

    await expect(supabaseRequest(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
  });
});
