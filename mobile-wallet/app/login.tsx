import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Modal, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';

const BASE_URL = 'http://10.77.98.11:8082'; // ✅ ngrok

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinHash, setPinHash] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ type: 'error'; message: string } | null>(null);
  const modalScale = useRef(new Animated.Value(0)).current;

  const showModal = (message: string) => {
    setModal({ type: 'error', message });
    Animated.spring(modalScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
  };

  const hideModal = () => {
    Animated.timing(modalScale, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setModal(null));
  };

  const handleLogin = async () => {
    if (!phoneNumber.trim() || phoneNumber.trim().length < 10) {
      showModal('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!pinHash.trim() || pinHash.trim().length < 4) {
      showModal('Please enter your 4-digit PIN.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          pinHash: pinHash.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Login failed');
      }

      const user = await response.json();

      // ✅ Restore session to AsyncStorage
      await AsyncStorage.setItem('USER_ID', user.id);
      await AsyncStorage.setItem('USER_NAME', user.fullName);
      await AsyncStorage.setItem('USER_PHONE', user.phoneNumber);
      await AsyncStorage.setItem('USER_PIN', pinHash.trim());

      router.replace('/');
    } catch (error: any) {
      if (error.message?.includes('Network request failed')) {
        showModal('Cannot connect to server. Make sure Spring Boot is running.');
      } else {
        showModal(error.message || 'Login failed. Please try again.');
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
      {/* Error Modal */}
      <Modal transparent visible={!!modal} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: modalScale }] }]}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="close-circle" size={48} color="#dc2626" />
            </View>
            <Text style={styles.modalTitle}>Oops!</Text>
            <Text style={styles.modalMessage}>{modal?.message}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={hideModal}>
              <Text style={styles.modalBtnText}>Try Again</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet-outline" size={40} color="#1a73e8" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your Offline UPI wallet</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
              autoFocus
            />
          </View>

          <Text style={styles.label}>PIN</Text>
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

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.loginButtonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Register Link */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/register' as any)}
          >
            <Ionicons name="person-add-outline" size={18} color="#1a73e8" style={{ marginRight: 8 }} />
            <Text style={styles.registerButtonText}>Create New Account</Text>
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#1a73e8" />
            <Text style={styles.infoText}>
              Your cloud balance and transaction history are safely stored on the server and will be restored on login.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#bfdbfe' },
  title: { fontSize: 28, fontWeight: '800', color: '#202124', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5f6368' },
  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderWidth: 1.5, borderColor: '#e8eaed', borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#202124', paddingVertical: 14 },
  eyeIcon: { padding: 4 },
  loginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: '#e8eaed' },
  dividerText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  registerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 14, paddingVertical: 14 },
  registerButtonText: { color: '#1a73e8', fontSize: 15, fontWeight: '700' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#e8f0fe', borderRadius: 10, padding: 12, marginTop: 24, gap: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#1a73e8', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', elevation: 20 },
  modalIconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 10 },
  modalMessage: { fontSize: 15, color: '#5f6368', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  modalBtn: { backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});