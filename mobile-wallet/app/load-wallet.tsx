import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import BASE_URL from '../config';
export default function LoadWalletScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'amount' | 'pin'>('amount');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ type: 'success' | 'error' | 'warn'; title: string; message: string } | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const showModal = (type: 'success' | 'error' | 'warn', title: string, message: string) => {
    setModal({ type, title, message });
    Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
  };

  const hideModal = (goBack = false) => {
    Animated.timing(successScale, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setModal(null);
      if (goBack) router.back();
    });
  };

  const handleAmountNext = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      showModal('warn', 'Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }
    if (val > 10000) {
      showModal('warn', 'Limit Exceeded', 'Maximum load amount is ₹10,000 per transaction.');
      return;
    }
    setStep('pin');
  };

  const handlePinKey = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 4) setTimeout(() => verifyAndLoad(newPin), 200);
  };

  const verifyAndLoad = async (enteredPin: string) => {
    setLoading(true);
    try {
      const savedPin = await AsyncStorage.getItem('USER_PIN');
      if (!savedPin) {
        await AsyncStorage.setItem('USER_PIN', enteredPin);
      } else if (savedPin !== enteredPin) {
        shake();
        setPin('');
        setLoading(false);
        showModal('error', 'Wrong PIN', 'Incorrect PIN. Please try again.');
        return;
      }

      const userId = await AsyncStorage.getItem('USER_ID');
      if (!userId) {
        showModal('error', 'Not Registered', 'Please register first before loading wallet.');
        router.replace('/register' as any);
        return;
      }

      const response = await fetch(`${BASE_URL}/api/wallet/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: parseFloat(amount) }),
      });

      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const jwt = await response.text();
      await AsyncStorage.setItem('OFFLINE_VAULT_JWT', jwt);

      const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
      const newBal = (balStr ? parseFloat(balStr) : 0) + parseFloat(amount);
      await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

      const tx = {
        id: Date.now().toString(), type: 'load',
        amount: parseFloat(amount),
        date: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
      };
      const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
      const arr = hist ? JSON.parse(hist) : [];
      arr.unshift(tx);
      await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));

      showModal('success', 'Money Loaded!', `₹${parseFloat(amount).toFixed(2)} added to your Offline Vault successfully.`);
    } catch (e: any) {
      setPin('');
      if (e.message?.includes('Network request failed')) {
        showModal('error', 'No Connection', 'Cannot reach server. Please check your internet connection.');
      } else {
        showModal('error', 'Something went wrong', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const modalConfig = {
    success: { color: '#16a34a', bg: '#f0fdf4', icon: 'checkmark-circle' as const },
    error:   { color: '#dc2626', bg: '#fef2f2', icon: 'close-circle' as const },
    warn:    { color: '#d97706', bg: '#fffbeb', icon: 'warning' as const },
  };

  return (
    <View style={styles.root}>
      {/* Custom Modal */}
      <Modal transparent visible={!!modal} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: successScale }] }]}>
            {modal && (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: modalConfig[modal.type].bg }]}>
                  <Ionicons name={modalConfig[modal.type].icon} size={48} color={modalConfig[modal.type].color} />
                </View>
                <Text style={styles.modalTitle}>{modal.title}</Text>
                <Text style={styles.modalMessage}>{modal.message}</Text>
                {modal.type === 'success' ? (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: modalConfig[modal.type].color }]}
                    onPress={() => hideModal(true)}
                  >
                    <Text style={styles.modalBtnText}>Done</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: modalConfig[modal.type].color }]}
                    onPress={() => hideModal(false)}
                  >
                    <Text style={styles.modalBtnText}>OK</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{step === 'amount' ? 'Load Wallet' : 'Enter PIN'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {step === 'amount' ? (
        <KeyboardAvoidingView style={styles.amountContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.amountContent}>
            <View style={styles.iconBox}>
              <Ionicons name="wallet-outline" size={36} color="#1a73e8" />
            </View>
            <Text style={styles.label}>How much to load?</Text>
            <Text style={styles.sub}>Amount will be deducted from your cloud balance</Text>

            <View style={styles.amountInputRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#dadce0"
                autoFocus
                maxLength={6}
              />
            </View>

            <View style={styles.quickAmounts}>
              {['500', '1000', '2000', '5000'].map(q => (
                <TouchableOpacity key={q} style={[styles.quickChip, amount === q && styles.quickChipActive]} onPress={() => setAmount(q)}>
                  <Text style={[styles.quickChipText, amount === q && styles.quickChipTextActive]}>₹{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={handleAmountNext}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.pinContainer}>
          <View style={styles.iconBox}>
            <Ionicons name="lock-closed-outline" size={36} color="#1a73e8" />
          </View>
          <Text style={styles.label}>Enter your PIN</Text>
          <Text style={styles.sub}>Loading ₹{parseFloat(amount).toFixed(2)} to Offline Vault</Text>

          <Animated.View style={[styles.pinDots, { transform: [{ translateX: shakeAnim }] }]}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
            ))}
          </Animated.View>

          {loading ? (
            <ActivityIndicator size="large" color="#1a73e8" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.keypad}>
              {keys.map((k, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.key, k === '' && styles.keyEmpty]}
                  onPress={() => k && handlePinKey(k)}
                  disabled={k === ''}
                >
                  <Text style={[styles.keyText, k === '⌫' && styles.keyBackspace]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={() => { setStep('amount'); setPin(''); }}>
            <Text style={styles.changeAmount}>← Change amount</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f3f4' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#202124' },
  amountContainer: { flex: 1 },
  amountContent: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  iconBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  label: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 6 },
  sub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 36 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1a73e8', paddingBottom: 8, marginBottom: 28, width: '70%', justifyContent: 'center' },
  rupee: { fontSize: 36, fontWeight: '700', color: '#202124', marginRight: 4 },
  amountInput: { fontSize: 52, fontWeight: '800', color: '#202124', minWidth: 80, textAlign: 'center' },
  quickAmounts: { flexDirection: 'row', gap: 10, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' },
  quickChip: { borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  quickChipActive: { backgroundColor: '#1a73e8' },
  quickChipText: { color: '#1a73e8', fontWeight: '700', fontSize: 14 },
  quickChipTextActive: { color: '#fff' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pinContainer: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  pinDots: { flexDirection: 'row', gap: 18, marginTop: 36, marginBottom: 48 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#dadce0', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, justifyContent: 'center', gap: 12 },
  key: { width: 84, height: 72, borderRadius: 16, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 26, fontWeight: '600', color: '#202124' },
  keyBackspace: { fontSize: 20 },
  changeAmount: { marginTop: 28, color: '#1a73e8', fontSize: 14, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', elevation: 20 },
  modalIconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontSize: 15, color: '#5f6368', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  modalBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});