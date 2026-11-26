import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/core/providers/auth';

export default function AuthLayout() {
  const { ready, user } = useAuth();
  if (ready && user) return <Redirect href="/(app)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
