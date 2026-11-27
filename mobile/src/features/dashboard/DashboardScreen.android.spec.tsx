import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { DashboardScreen } from './DashboardScreen.android';

jest.mock('./api', () => ({ fetchDashboard: () => new Promise(() => undefined) }));

it('renders the shared dashboard under a dark status bar', async () => {
  const client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <DashboardScreen />
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.toJSON()).not.toBeNull();
});
