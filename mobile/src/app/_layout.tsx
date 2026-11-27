import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/core/log/ErrorBoundary';
import { Providers } from '@/core/providers';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <Providers>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </Providers>
    </ErrorBoundary>
  );
}
