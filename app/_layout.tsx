import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { initializeSubscriptions } from '../lib/subscriptionService';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    initializeSubscriptions();
    // Handle notification tap when app is opened from background
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'invite' && data?.roomCode) {
        router.push({
          pathname: '/(tabs)/room',
          params: { code: String(data.roomCode), name: '' }
        });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" />
      <Stack.Screen
        name="paywall"
        options={{
          presentation: 'modal',
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}