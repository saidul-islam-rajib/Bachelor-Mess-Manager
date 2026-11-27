import { Redirect, Tabs } from 'expo-router';
import { en } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { GroupPicker } from '@/features/groups/GroupPicker';
import { useUnreadCount } from '@/features/notifications/hooks';

export default function AppLayout() {
  const { ready, user } = useAuth();
  const unread = useUnreadCount();
  if (ready && !user) return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs screenOptions={{ headerRight: () => <GroupPicker /> }}>
      <Tabs.Screen name="home" options={{ title: en.tabs.home }} />
      <Tabs.Screen name="meals" options={{ title: en.tabs.meals }} />
      <Tabs.Screen name="money" options={{ title: en.tabs.money }} />
      <Tabs.Screen name="mess" options={{ title: en.tabs.mess }} />
      <Tabs.Screen name="more" options={{ title: en.tabs.more, tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="notifications" options={{ title: en.notifications.title, href: null }} />
    </Tabs>
  );
}
