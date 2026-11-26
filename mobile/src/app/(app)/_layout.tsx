import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/core/providers/auth';

export default function AppLayout() {
  const { ready, user } = useAuth();
  if (ready && !user) return <Redirect href="/(auth)/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
