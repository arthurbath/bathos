import { withMutationTiming } from '@/lib/mutationTiming';

export async function withDrawersDbTiming<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return withMutationTiming({ module: 'drawers', action: operation }, run);
}
