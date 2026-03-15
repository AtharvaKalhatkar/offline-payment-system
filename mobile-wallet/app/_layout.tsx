import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* Tab navigator — home, explore */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Stack screens — pushed on top of tabs */}
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="load-wallet" options={{ headerShown: false }} />
      <Stack.Screen name="send-qr" options={{ headerShown: false }} />
      <Stack.Screen name="receive-qr" options={{ headerShown: false }} />
      <Stack.Screen name="send-ble" options={{ headerShown: false }} />
      <Stack.Screen name="receive-ble" options={{ headerShown: false }} />

      {/* Modal */}
      <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}