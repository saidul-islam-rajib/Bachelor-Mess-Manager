import React from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth';
import { GroupProvider } from './group';
import { installGlobalHandler, logError } from '@/core/log';
import { ApiError } from '@/core/api/client';

installGlobalHandler();

const reportable = (error: unknown) => !(error instanceof ApiError);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (reportable(error)) logError('query.error', error, { key: String(query.queryKey[0] ?? '') });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (reportable(error)) logError('mutation.error', error);
    },
  }),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GroupProvider>{children}</GroupProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
