import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '@/core/providers';

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  );
}
