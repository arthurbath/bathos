import { QueryClient } from '@tanstack/react-query';

export function createBathOSQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 30_000,
      },
    },
  });
}

export const queryClient = createBathOSQueryClient();
