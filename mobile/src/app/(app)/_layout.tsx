import { Redirect, Tabs } from 'expo-router';
import { en } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { GroupPicker } from '@/features/groups/GroupPicker';

export default function AppLayout() {
  const { ready, user } = useAuth();
  if (ready && !user) return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs screenOptions={{ headerRight: () => <GroupPicker /> }}>
      <Tabs.Screen name="home" options={{ title: en.tabs.home }} />
      <Tabs.Screen name="meals" options={{ title: en.tabs.meals }} />
      <Tabs.Screen name="money" options={{ title: en.tabs.money }} />
      <Tabs.Screen name="mess" options={{ title: en.tabs.mess }} />
      <Tabs.Screen name="more" options={{ title: en.tabs.more }} />
    </Tabs>
  );
}
