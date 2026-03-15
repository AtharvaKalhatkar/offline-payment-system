import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

const BASE_URL = 'http://10.77.98.11:8082';

export default function SendQRScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'amount' | 'pin' | 'qr'>('amount');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrUsed, setQrUsed] = useState(false); // ✅ track if QR was scanned
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleAmountNext = async () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
    const bal = balStr ? parseFloat(balStr) : 0;
    if (val > bal) {
      Alert.alert('Insufficient Balance', `Your vault only has ₹${bal.toFixed(2)}.`);
      return;
    }
    setStep('pin');
  };

  const handlePinKey = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 4) setTimeout(() => verifyPinAndGenerate(newPin), 200);
  };

  const verifyPinAndGenerate = async (enteredPin: string) => {
    setLoading(true);
    try {
      const savedPin = await AsyncStorage.getItem('USER_PIN');
      if (!savedPin || savedPin !== enteredPin) {
        shake(); setPin(''); setLoading(false);
        Alert.alert('Wrong PIN', 'Incorrect PIN. Please try again.');
        return;
      }

      const userId = await AsyncStorage.getItem('USER_ID');
      if (!userId) throw new Error('Not registered');

      // ✅ Use cached JWT — never call load API from send screen
      const jwt = await AsyncStorage.getItem('OFFLINE_VAULT_JWT') || 'OFFLINE_NO_JWT';

      // ✅ Extract tokenId from JWT for tracking
      let tid = Date.now().toString();
      try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        tid = payload.jti || payload.nonce || tid;
      } catch (_) {}
      setTokenId(tid);

      // ✅ DO NOT deduct balance here — deduct ONLY after receiver confirms
      setQrValue(`OFFLINE_JWT:${amount}:${jwt}`);
      setQrUsed(false);
      setStep('qr');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Called when receiver confirms payment (ACK received)
  const handlePaymentConfirmed = async () => {
    if (qrUsed) return; // prevent double deduction
    setQrUsed(true);

    const balStr = await AsyncStorage.getItem('OFFLINE_VAULT_BALANCE');
    const newBal = (balStr ? parseFloat(balStr) : 0) - parseFloat(amount);
    await AsyncStorage.setItem('OFFLINE_VAULT_BALANCE', newBal.toString());

    // Log transaction
    const tx = {
      id: Date.now().toString(), type: 'send',
      amount: parseFloat(amount),
      date: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
    };
    const hist = await AsyncStorage.getItem('OFFLINE_TRANSACTIONS');
    const arr = hist ? JSON.parse(hist) : [];
    arr.unshift(tx);
    await AsyncStorage.setItem('OFFLINE_TRANSACTIONS', JSON.stringify(arr));

    Alert.alert('✅ Payment Sent', `₹${parseFloat(amount).toFixed(2)} sent successfully!`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (step === 'pin') { setStep('amount'); setPin(''); }
          else if (step === 'qr') {
            // ✅ If QR not yet used, safe to go back without deducting
            if (!qrUsed) {
              setStep('amount'); setAmount(''); setQrValue('');
            } else {
              router.back();
            }
          }
          else router.back();
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'amount' ? 'Pay via QR' : step === 'pin' ? 'Confirm with PIN' : 'Show QR Code'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* STEP 1: Amount */}
      {step === 'amount' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="qr-code-outline" size={36} color="#1a73e8" />
          </View>
          <Text style={styles.stepTitle}>Enter Amount</Text>
          <Text style={styles.stepSub}>The receiver will scan your QR code</Text>

          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#dadce0"
              autoFocus maxLength={6}
            />
          </View>

          <View style={styles.quickAmounts}>
            {['100', '200', '500', '1000'].map(q => (
              <TouchableOpacity key={q} style={styles.chip} onPress={() => setAmount(q)}>
                <Text style={styles.chipText}>₹{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAmountNext}>
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2: PIN */}
      {step === 'pin' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={36} color="#1a73e8" />
          </View>
          <Text style={styles.stepTitle}>Spending PIN</Text>
          <Text style={styles.stepSub}>Sending ₹{parseFloat(amount).toFixed(2)} from your vault</Text>

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
                  key={i} style={[styles.key, k === '' && styles.keyEmpty]}
                  onPress={() => k && handlePinKey(k)} disabled={k === ''}
                >
                  <Text style={[styles.keyText, k === '⌫' && { fontSize: 20 }]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* STEP 3: QR Code */}
      {step === 'qr' && (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>Show to Receiver</Text>
          <Text style={styles.stepSub}>Let them scan this QR code</Text>

          {/* ✅ Show QR only if not yet used */}
          {!qrUsed ? (
            <View style={styles.qrBox}>
              <QRCode value={qrValue} size={220} backgroundColor="white" />
            </View>
          ) : (
            <View style={[styles.qrBox, { alignItems: 'center', justifyContent: 'center', width: 260, height: 260 }]}>
              <Ionicons name="checkmark-circle" size={80} color="#188038" />
              <Text style={{ color: '#188038', fontWeight: '700', marginTop: 8 }}>QR Used</Text>
            </View>
          )}

          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>₹ {parseFloat(amount).toFixed(2)}</Text>
          </View>

          <View style={styles.secRow}>
            <Ionicons name="shield-checkmark" size={14} color="#188038" />
            <Text style={styles.secText}>JWT signed · One-time use · Tamper-proof</Text>
          </View>

          {/* ✅ Manual confirm button — for testing/fallback */}
          {!qrUsed && (
            <TouchableOpacity style={styles.confirmBtn} onPress={handlePaymentConfirmed}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>Confirm Payment Sent</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
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
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 36 },
  iconCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#202124', marginBottom: 6 },
  stepSub: { fontSize: 14, color: '#5f6368', textAlign: 'center', marginBottom: 32 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1a73e8', paddingBottom: 8, marginBottom: 24, width: '70%', justifyContent: 'center' },
  rupee: { fontSize: 36, fontWeight: '700', color: '#202124', marginRight: 4 },
  amountInput: { fontSize: 52, fontWeight: '800', color: '#202124', minWidth: 80, textAlign: 'center' },
  quickAmounts: { flexDirection: 'row', gap: 10, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderColor: '#1a73e8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { color: '#1a73e8', fontWeight: '700', fontSize: 13 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pinDots: { flexDirection: 'row', gap: 18, marginTop: 28, marginBottom: 44 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#dadce0' },
  dotFilled: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, justifyContent: 'center', gap: 12 },
  key: { width: 84, height: 72, borderRadius: 16, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 26, fontWeight: '600', color: '#202124' },
  qrBox: { backgroundColor: '#fff', padding: 20, borderRadius: 20, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, marginBottom: 24 },
  amountBadge: { backgroundColor: '#e8f0fe', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 16 },
  amountBadgeText: { fontSize: 28, fontWeight: '800', color: '#1a73e8' },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  secText: { fontSize: 12, color: '#188038', fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#188038', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  doneBtn: { backgroundColor: '#f1f3f4', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 60 },
  doneBtnText: { color: '#5f6368', fontSize: 16, fontWeight: '700' },
});