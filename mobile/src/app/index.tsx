import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/core/providers/auth';

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={user ? '/(app)/home' : '/(auth)/sign-in'} />;
}
