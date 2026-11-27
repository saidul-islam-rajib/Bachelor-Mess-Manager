import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { SettlementScreen } from './SettlementScreen.android';

it('renders the shared settlement screen under a dark status bar', async () => {
  globalThis.fetch = jest.fn(() => new Promise(() => undefined)) as unknown as typeof fetch;
  const client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <SettlementScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.toJSON()).not.toBeNull();
});
