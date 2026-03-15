import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://10.77.98.11:8082'; // 🔴 your LAN IP

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinHash, setPinHash] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !phoneNumber.trim() || !pinHash.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (phoneNumber.trim().length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (pinHash.trim().length < 4) {
      Alert.alert('Weak PIN', 'PIN must be at least 4 digits.');
      return;
    }
    if (pinHash !== confirmPin) {
      Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          pinHash: pinHash.trim(),
        }),
      });

      if (!response.ok) {
        if (response.status === 400) throw new Error('This phone number is already registered!');
        throw new Error(`Server error ${response.status}`);
      }

      const user = await response.json();

      // ✅ Save user details + PIN to AsyncStorage
      await AsyncStorage.setItem('USER_ID', user.id);
      await AsyncStorage.setItem('USER_NAME', user.fullName);
      await AsyncStorage.setItem('USER_PHONE', user.phoneNumber);
      await AsyncStorage.setItem('USER_PIN', pinHash.trim()); // save PIN for spending

      Alert.alert(
        '✅ Registered!',
        `Welcome, ${user.fullName}!\nStarting balance: ₹${user.cloudBalance}`,
        [{ text: 'Go to Wallet', onPress: () => router.replace('/') }]
      );
    } catch (error: any) {
      if (error.message?.includes('Network request failed')) {
        Alert.alert('❌ Cannot Connect', `Make sure Spring Boot is running.\n\nURL: ${BASE_URL}`);
      } else {
        Alert.alert('❌ Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={40} color="#1a73e8" />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Set up your Offline UPI wallet</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Atharva Kalhatkar"
              placeholderTextColor="#9ca3af"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9ca3af"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          <Text style={styles.label}>Set PIN (for spending)</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="4-digit PIN"
              placeholderTextColor="#9ca3af"
              value={pinHash}
              onChangeText={setPinHash}
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TouchableOpacity onPress={() => setShowPin(!showPin)} style={styles.eyeIcon}>
              <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm PIN</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter PIN"
              placeholderTextColor="#9ca3af"
              value={confirmPin}
              onChangeText={setConfirmPin}
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#1a73e8" />
            <Text style={styles.infoText}>
              You'll receive ₹1,000 starting balance. Your PIN is used to load and spend from the vault.
            </Text>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.registerButtonText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Already registered? Go to Wallet →</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#bfdbfe' },
  title: { fontSize: 28, fontWeight: '800', color: '#202124', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5f6368' },
  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderWidth: 1.5, borderColor: '#e8eaed', borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#202124', paddingVertical: 14 },
  eyeIcon: { padding: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#e8f0fe', borderRadius: 10, padding: 12, marginTop: 20, gap: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#1a73e8', lineHeight: 18 },
  registerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  loginLinkText: { color: '#1a73e8', fontSize: 14, fontWeight: '600' },
});