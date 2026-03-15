import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>

      {/* Tab navigator — home, explore */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Auth / user */}
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />

      {/* Wallet */}
      <Stack.Screen name="load-wallet" options={{ headerShown: false }} />

      {/* QR Payments */}
      <Stack.Screen name="send-qr" options={{ headerShown: false }} />
      <Stack.Screen name="receive-qr" options={{ headerShown: false }} />

      {/* BLE Payments */}
      <Stack.Screen name="send-ble" options={{ headerShown: false }} />
      <Stack.Screen name="receive-ble" options={{ headerShown: false }} />

      {/* NFC Payments ✅ */}
      <Stack.Screen name="send-nfc" options={{ headerShown: false }} />
      <Stack.Screen name="receive-nfc" options={{ headerShown: false }} />

      {/* Modal */}
      <Stack.Screen
        name="modal"
        options={{ presentation: 'modal', headerShown: false }}
      />

    </Stack>
  );
}