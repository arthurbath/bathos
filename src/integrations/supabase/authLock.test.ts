import { processLock } from '@supabase/auth-js';
import { TASKS_NATIVE_BRIDGE_HANDLER } from '@/platform/native/tasksNativeCompanion';
import { resolveSupabaseAuthLock } from './authLock';

describe('resolveSupabaseAuthLock', () => {
  it('uses the process-local serialized lock in the native Tasks companion', () => {
    const target = {
      webkit: {
        messageHandlers: {
          [TASKS_NATIVE_BRIDGE_HANDLER]: {
            postMessage: vi.fn(),
          },
        },
      },
    } as unknown as Window;

    expect(resolveSupabaseAuthLock(target)).toBe(processLock);
  });

  it('leaves ordinary browser lock selection to Supabase', () => {
    expect(resolveSupabaseAuthLock({} as Window)).toBeUndefined();
  });
});
