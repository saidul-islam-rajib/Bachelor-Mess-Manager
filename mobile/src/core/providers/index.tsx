import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth';
import { GroupProvider } from './group';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GroupProvider>{children}</GroupProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
